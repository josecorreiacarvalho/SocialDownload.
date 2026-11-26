import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@TikDownload:downloads";

export type DownloadStatus =
  | "baixando"
  | "concluido"
  | "falha";

export type DownloadItem = {
  id: string;
  nome: string;
  progresso: number;
  status: DownloadStatus;
  tamanho: number;
  uri?: string;
  erro?: string;
  data: number;
};

let downloads: DownloadItem[] = [];
let carregado = false;
let carregamento: Promise<void> | null = null;
let filaSalvamento = Promise.resolve();

const ouvintes = new Set<() => void>();

function notificar() {
  ouvintes.forEach((ouvinte) => ouvinte());
}

function salvarDownloads() {
  const conteudo = JSON.stringify(downloads);

  filaSalvamento = filaSalvamento
    .then(() =>
      AsyncStorage.setItem(STORAGE_KEY, conteudo)
    )
    .catch((erro) => {
      console.log("ERRO AO SALVAR DOWNLOADS:", erro);
    });

  return filaSalvamento;
}

export function carregarDownloads(): Promise<void> {
  if (carregado) {
    return Promise.resolve();
  }

  if (carregamento) {
    return carregamento;
  }

  carregamento = (async () => {
    try {
      const valor = await AsyncStorage.getItem(STORAGE_KEY);

      if (valor) {
        const lista: DownloadItem[] = JSON.parse(valor);

        if (Array.isArray(lista)) {
          const anteriores = lista.map((item) =>
            item.status === "baixando"
              ? {
                  ...item,
                  status: "falha" as const,
                  erro: "Download interrompido.",
                }
              : item
          );

          const ids = new Set(
            downloads.map((item) => item.id)
          );

          downloads = [
            ...downloads,
            ...anteriores.filter(
              (item) => !ids.has(item.id)
            ),
          ];
        }
      }

      carregado = true;

      notificar();

      await salvarDownloads();

    } catch (erro) {
      console.log("ERRO AO CARREGAR DOWNLOADS:", erro);
    }
  })().finally(() => {
    carregamento = null;
  });

  return carregamento;
}

function persistirDownloads() {
  if (carregado) {
    void salvarDownloads();
  } else {
    void carregarDownloads();
  }
}

export function obterDownloads() {
  return downloads;
}

export function observarDownloads(
  ouvinte: () => void
) {
  ouvintes.add(ouvinte);

  void carregarDownloads();

  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function iniciarDownload(nome: string) {
  const id = Date.now().toString();

  downloads = [
    {
      id,
      nome,
      progresso: 0,
      status: "baixando",
      tamanho: 0,
      data: Date.now(),
    },
    ...downloads,
  ];

  notificar();
  persistirDownloads();

  return id;
}

export function atualizarDownload(
  id: string,
  dados: Partial<DownloadItem>
) {
  downloads = downloads.map((item) =>
    item.id === id
      ? { ...item, ...dados }
      : item
  );

  notificar();

  if (dados.status && dados.status !== "baixando") {
    persistirDownloads();
  }
}

export function concluirDownload(
  id: string,
  uri: string,
  tamanho: number
) {
  atualizarDownload(id, {
    status: "concluido",
    progresso: 100,
    uri,
    tamanho,
  });
}

export function falharDownload(
  id: string,
  erro: string
) {
  atualizarDownload(id, {
    status: "falha",
    erro,
  });
}

export function removerDownload(id: string) {
  downloads = downloads.filter(
    (item) => item.id !== id
  );

  notificar();
  persistirDownloads();
}

export function removerDownloadPorUri(uri: string) {
  downloads = downloads.filter(
    (item) => item.uri !== uri
  );

  notificar();
  persistirDownloads();
}

export function limparHistorico() {
  downloads = downloads.filter(
    (item) => item.status === "baixando"
  );

  notificar();
  persistirDownloads();
}

void carregarDownloads();