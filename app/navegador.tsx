import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";

import { WebView } from "react-native-webview";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useRef, useState, useEffect } from "react";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  iniciarDownload,
  atualizarDownload,
  concluirDownload,
  falharDownload,
} from "../downloadStorage";

export default function NavegadorScreen() {
  const router = useRouter();
  const recebido = useRef(false);

  const [mostrarSite, setMostrarSite] = useState(false);

  const { link } = useLocalSearchParams<{
    link: string;
  }>();

  const endereco = typeof link === "string" ? link : "";
  const instagram = (() => {
    try {
      const url = new URL(endereco);
      return url.protocol === "https:" &&
        (url.hostname === "instagram.com" || url.hostname.endsWith(".instagram.com"));
    } catch { return false; }
  })();
  const [videoInstagram, setVideoInstagram] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!recebido.current) {
        setMostrarSite(true);
      }
    }, 20000);

    return () => clearTimeout(timer);
  }, []);

  const scriptTikTok = `
    (function() {
      if (window.location.origin !== "https://ssstik.io") {
        return;
      }

      if (window.tikDownloadIniciado) {
        return;
      }

      window.tikDownloadIniciado = true;

      let tentativas = 0;
      let enviado = false;

      const timer = setInterval(function() {
        tentativas++;

        if (!enviado) {
          const campo = document.querySelector(
            '#main_page_text, input[name="id"], input[type="url"], input[type="text"]'
          );

          if (campo) {
            campo.value = ${JSON.stringify(link ?? "")};

            campo.dispatchEvent(
              new Event('input', { bubbles: true })
            );

            campo.dispatchEvent(
              new Event('change', { bubbles: true })
            );

            const formulario = campo.closest('form');

            if (formulario) {
              const botao = formulario.querySelector(
                'button[type="submit"], input[type="submit"]'
              );

              if (botao && !botao.disabled) {
                enviado = true;

                setTimeout(function() {
                  botao.click();
                }, 1000);
              }
            }
          }
        }

        const botoes = document.querySelectorAll('a[href]');

        for (const botao of botoes) {
          const texto = botao.textContent
            .trim()
            .toLowerCase();

          if (
            texto.includes('without watermark') &&
            !texto.includes('mp3')
          ) {
            const endereco = botao.href;

            if (endereco.startsWith('https://')) {
              clearInterval(timer);

              window.ReactNativeWebView.postMessage(
                JSON.stringify({
                  tipo: 'video',
                  url: endereco
                })
              );

              return;
            }
          }
        }

        if (tentativas >= 120) {
          clearInterval(timer);

          window.ReactNativeWebView.postMessage(
            JSON.stringify({
              tipo: 'verificacao'
            })
          );
        }

      }, 500);
    })();

    true;
  `;

  const scriptInstagram = `
    (function() {
      if (!/(^|\\.)instagram\\.com$/.test(location.hostname)) return;
      if (window.socialDownloadObservando) return;
      window.socialDownloadObservando = true;
      let anterior = '';
      setInterval(function() {
        const videos = Array.from(document.querySelectorAll('video'));
        const video = videos.find(v => !v.paused && v.readyState >= 2);
        const url = video && (video.currentSrc || video.src);
        if (url && url !== anterior && url.startsWith('https://')) {
          anterior = url;
          window.ReactNativeWebView.postMessage(JSON.stringify({tipo:'candidato', url:url}));
        }
      }, 1000);
    })();
    true;
  `;

  function urlInstagramValida(valor: string) {
    try {
      const u = new URL(valor);
      return u.protocol === "https:" &&
        (u.hostname.endsWith(".cdninstagram.com") || u.hostname.endsWith(".fbcdn.net"));
    } catch { return false; }
  }

  async function salvarNaGaleria(uri: string) {
  try {
    const configuracao = await AsyncStorage.getItem(
      "@TikDownload:salvarGaleria"
    );

    if (configuracao === "false") {
      return;
    }

    const permissao =
      await MediaLibrary.requestPermissionsAsync(true);

    if (!permissao.granted) {
      console.log("Permissão da galeria não concedida.");
      return;
    }

    await MediaLibrary.saveToLibraryAsync(uri);

    console.log("VÍDEO SALVO NA GALERIA");

  } catch (erro) {
    console.log("ERRO AO SALVAR NA GALERIA:", erro);
  }
}

  async function receberMensagem(mensagem: string) {
    let downloadId: string | null = null;
    let destino: string | null = null;

    try {
      const dados = JSON.parse(mensagem);

      if (instagram && dados.tipo === "candidato") {
        if (typeof dados.url === "string" && urlInstagramValida(dados.url)) {
          setVideoInstagram(dados.url);
        }
        return;
      }

      if (dados.tipo === "verificacao") {
        setMostrarSite(true);
        return;
      }

      if (
        dados.tipo !== "video" ||
        typeof dados.url !== "string" ||
        !dados.url.startsWith("https://") ||
        (instagram && !urlInstagramValida(dados.url)) ||
        recebido.current
      ) {
        return;
      }

      recebido.current = true;

      const nome = `${instagram ? "Instagram" : "TikDownload"}_${Date.now()}.mp4`;

      downloadId = iniciarDownload(nome);

      const id = downloadId;

      const pasta =
        FileSystem.documentDirectory + "videos/";

      await FileSystem.makeDirectoryAsync(pasta, {
        intermediates: true,
      });

      destino = pasta + nome;

      const download = FileSystem.createDownloadResumable(
        dados.url,
        destino,
        {},
        (progresso) => {
          if (progresso.totalBytesExpectedToWrite > 0) {
            const percentual =
              (progresso.totalBytesWritten /
                progresso.totalBytesExpectedToWrite) *
              100;

            atualizarDownload(id, {
              progresso: Math.min(
                99,
                Math.round(percentual)
              ),
              tamanho: progresso.totalBytesWritten,
            });

            console.log(
              "Baixando:",
              percentual.toFixed(0) + "%"
            );
          }
        }
      );

      // Abre nossa aba Downloads antes da conclusão.
      router.replace("/(tabs)/downloads");

      const resultado = await download.downloadAsync();

      if (!resultado || resultado.status !== 200) {
        throw new Error("Falha no download.");
      }

      const arquivo = await FileSystem.getInfoAsync(
        resultado.uri
      );

      if (!arquivo.exists || !arquivo.size) {
        throw new Error("Arquivo inválido.");
      }

      const assinatura =
        await FileSystem.readAsStringAsync(
          destino,
          {
            encoding: FileSystem.EncodingType.Base64,
            position: 4,
            length: 4,
          }
        );

      if (assinatura !== "ZnR5cA==") {
        throw new Error(
          "O arquivo recebido não é um MP4 válido."
        );
      }

      concluirDownload(
        id,
        resultado.uri,
        arquivo.size
      );

      await salvarNaGaleria(resultado.uri);

      console.log("FORMATO MP4 CONFIRMADO");
      console.log("VÍDEO SALVO:", resultado.uri);

    } catch (erro) {
      recebido.current = false;

      const mensagemErro =
        erro instanceof Error
          ? erro.message
          : "Não foi possível baixar o vídeo.";

      if (downloadId) {
        falharDownload(downloadId, mensagemErro);
      }

      if (destino) {
        await FileSystem.deleteAsync(destino, {
          idempotent: true,
        }).catch(() => {});
      }

      console.log("ERRO NO DOWNLOAD:", erro);

    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons
            name="arrow-back"
            size={25}
            color="#075985"
          />
        </Pressable>

        <Text style={styles.title}>
          {instagram ? "Instagram" : "SocialDownload"}
        </Text>
      </View>

      <View style={styles.browserContainer}>
        <WebView
          source={{ uri: instagram ? endereco : "https://ssstik.io/" }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          injectedJavaScript={instagram ? scriptInstagram : scriptTikTok}
          onShouldStartLoadWithRequest={(request) => {
            if (!instagram) return true;
            try {
              const u = new URL(request.url);
              return u.protocol === "https:" && (u.hostname === "instagram.com" || u.hostname.endsWith(".instagram.com"));
            } catch { return false; }
          }}
          onMessage={(event) => {
            void receberMensagem(
              event.nativeEvent.data
            );
          }}
        />

        {instagram && (
          <View style={{ padding: 12, backgroundColor: "#E6F4FE" }}>
            <Text style={styles.processingText}>
              {videoInstagram ? "Vídeo detectado. Salve apenas conteúdo autorizado." : "Reproduza o vídeo para testar a detecção."}
            </Text>
            <Pressable
              disabled={!videoInstagram}
              style={[styles.manualButton, { marginTop: 8, opacity: videoInstagram ? 1 : 0.5 }]}
              onPress={() => {
                if (videoInstagram) void receberMensagem(JSON.stringify({ tipo: "video", url: videoInstagram }));
              }}
            >
              <Ionicons name="download-outline" size={20} color="#075985" />
              <Text style={styles.manualText}>Salvar vídeo</Text>
            </Pressable>
          </View>
        )}
        {!instagram && !mostrarSite && (
          <View style={styles.processingScreen}>
            <View style={styles.processingCard}>
              <Ionicons
                name="cloud-download-outline"
                size={65}
                color="#075985"
              />

              <Text style={styles.processingTitle}>
                Processando vídeo
              </Text>

              <ActivityIndicator
                size="large"
                color="#075985"
                style={styles.loading}
              />

              <Text style={styles.processingText}>
                Localizando o arquivo de vídeo.
              </Text>

              <Text style={styles.waitText}>
                Aguarde alguns instantes...
              </Text>

              <Pressable
                style={styles.manualButton}
                onPress={() => setMostrarSite(true)}
              >
                <Ionicons
                  name="globe-outline"
                  size={18}
                  color="#075985"
                />

                <Text style={styles.manualText}>
                  Abrir página de download
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 35,
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 15,
    backgroundColor: "#E6F4FE",
  },

  backButton: {
    padding: 8,
  },

  title: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 20,
    color: "#183B56",
  },

  browserContainer: {
    flex: 1,
  },

  webview: {
    flex: 1,
  },

  processingScreen: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#E6F4FE",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },

  processingCard: {
    width: "100%",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.45)",
    borderWidth: 1,
    borderColor: "rgba(100,130,160,0.40)",
    borderRadius: 25,
    paddingVertical: 30,
    paddingHorizontal: 15,
  },

  processingTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 21,
    color: "#183B56",
    marginTop: 15,
    textAlign: "center",
  },

  loading: {
    marginVertical: 25,
  },

  processingText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: "#183B56",
    textAlign: "center",
  },

  waitText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: "#475569",
    marginTop: 5,
  },

  manualButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 25,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: "rgba(100,130,160,0.40)",
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.35)",
  },

  manualText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: "#075985",
  },
});