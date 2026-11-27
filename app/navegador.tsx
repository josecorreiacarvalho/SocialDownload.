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
  const plataformas = [
    {
      nome: "Instagram",
      dominios: ["instagram.com"],
      cdns: ["cdninstagram.com", "fbcdn.net"],
    },
    {
      nome: "Facebook",
      dominios: ["facebook.com", "fb.watch", "fb.com"],
      cdns: ["fbcdn.net"],
    },
    {
      nome: "Pinterest",
      dominios: ["pinterest.com", "pinterest.com.br", "pin.it"],
      cdns: ["pinimg.com"],
    },
    {
      nome: "X",
      dominios: ["x.com", "twitter.com"],
      cdns: ["video.twimg.com"],
    },
  ];
  const pertence = (host: string, dominios: string[]) =>
    dominios.some((d) => host === d || host.endsWith("." + d));
  const plataforma = (() => {
    try {
      const u = new URL(endereco);
      return u.protocol === "https:"
        ? plataformas.find((p) => pertence(u.hostname, p.dominios))
        : undefined;
    } catch {
      return undefined;
    }
  })();
  const redeDireta = !!plataforma;
  const usarFastDL = plataforma?.nome === "Instagram";
  const story =
    plataforma?.nome === "Instagram" &&
    (() => { try { return new URL(endereco).pathname.startsWith("/stories/"); } catch { return false; } })();
  const [tipoDetectado, setTipoDetectado] = useState<"video" | "foto">("video");
  const [videoDetectado, setVideoDetectado] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!recebido.current) {
        setMostrarSite(true);
      }
    }, usarFastDL ? 60000 : 20000);
    return () => clearTimeout(timer);
  }, [usarFastDL]);
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
  const scriptFastDL = `
    (function() {
      if (!['fastdl.app','www.fastdl.app'].includes(location.hostname)) return;
      if (window.fastDLIniciado) return;
      window.fastDLIniciado = true;
      const link = ${JSON.stringify(endereco.trim())};
      let tentativas = 0, preenchido = false, enviado = false;
      const visivel = e => e.getClientRects().length > 0;
      const texto = e => (e.textContent || e.value || '').trim().toLowerCase();
      function enviar(valor) {
        if (!valor || enviado) return false;
        try {
          const u = new URL(valor, location.href);
          if (u.protocol !== 'https:' || !['fastdl.app','cdninstagram.com','fbcdn.net'].some(d => u.hostname === d || u.hostname.endsWith('.' + d))) return false;
          enviado = true;
          window.ReactNativeWebView.postMessage(JSON.stringify({tipo:'video',url:u.href}));
          return true;
        } catch (_) { return false; }
      }
      const timer = setInterval(function() {
        tentativas++;
        const resultado = Array.from(document.querySelectorAll('h1,h2,h3,h4')).some(e => /resultado da pesquisa|search result/i.test(texto(e)));
        if (resultado) {
          const links = Array.from(document.querySelectorAll('a[href]')).filter(e => visivel(e) && ['baixar','download'].includes(texto(e)));
          for (const a of links) {
            const href = a.getAttribute('href');
            if (href && !href.startsWith('#') && enviar(a.href)) break;
          }
          if (!enviado) for (const v of document.querySelectorAll('video')) {
            if (enviar(v.currentSrc || v.src)) break;
            for (const source of v.querySelectorAll('source[src]')) if (enviar(source.src)) break;
          }
        } else if (!preenchido && tentativas >= 5 && document.readyState === 'complete') {
          const campo = Array.from(document.querySelectorAll('#search-form-input, input[type="url"], input[type="text"]')).find(visivel);
          const form = campo && campo.closest('form');
          const botoes = Array.from((form || document).querySelectorAll('button, input[type="submit"]'));
          const botao = botoes.find(e => visivel(e) && (['baixar','download'].includes(texto(e)) || e.type === 'submit'));
          if (campo && botao) {
            preenchido = true;
            campo.focus();
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(campo,link);
            campo.dispatchEvent(new Event('input',{bubbles:true}));
            campo.dispatchEvent(new Event('change',{bubbles:true}));
            setTimeout(function(){ if (campo.value === link && !botao.disabled) botao.click(); },1200);
          }
        }
        if (enviado || tentativas >= 120) {
          clearInterval(timer);
          if (!enviado) window.ReactNativeWebView.postMessage(JSON.stringify({tipo:'verificacao'}));
        }
      },500);
    })();
    true;
  `;
  const scriptRedeSocial = `
    (function() {
      const dominios = ${JSON.stringify(plataforma?.dominios ?? [])};
      const cdns = ${JSON.stringify(plataforma?.cdns ?? [])};
      const pertence = (host, lista) => lista.some(d => host === d || host.endsWith('.' + d));
      if (!pertence(location.hostname, dominios)) return;
      if (window.socialDownloadObservando) return;
      window.socialDownloadObservando = true;
      let anterior = '';
      const story = ${JSON.stringify(story)};
      function verificar() {
        const videos = Array.from(document.querySelectorAll('video'));
        const video = videos.find(v => !v.paused) || (videos.length === 1 ? videos[0] : null);
        let tipo = "video";
        const urls = video ? [video.currentSrc, video.src, ...Array.from(video.querySelectorAll('source')).map(s => s.src)] : [];
        if (${JSON.stringify(plataforma?.nome === "Instagram")}) {
          const meta = document.querySelectorAll('meta[property="og:video"], meta[property="og:video:url"], meta[property="og:video:secure_url"]');
          for (const item of meta) urls.push(item.content);
        } else if (!video) return;
        if (story && !location.pathname.startsWith('/stories/')) {
          anterior = '';
          window.ReactNativeWebView.postMessage(JSON.stringify({tipo:'semCandidato'}));
          return;
        }
        if (story && !video && !urls.length) {
          const imagens = Array.from(document.querySelectorAll('img')).filter(img => {
            const r = img.getBoundingClientRect();
            return img.naturalWidth >= 300 && r.width >= 180 && r.height >= 220 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
          });
          imagens.sort((a,b) => b.clientWidth*b.clientHeight-a.clientWidth*a.clientHeight);
          if (imagens.length) { urls.push(imagens[0].currentSrc || imagens[0].src); tipo = 'foto'; }
        }
        for (const valor of urls) {
          try {
            const u = new URL(valor);
            if (u.protocol !== 'https:' || !pertence(u.hostname, cdns)) continue;
            if (u.href !== anterior) {
              anterior = u.href;
              window.ReactNativeWebView.postMessage(JSON.stringify({tipo:'candidato', url:u.href, midia:tipo}));
            }
            return;
          } catch (_) {}
        }
        if (anterior) {
          anterior = '';
          window.ReactNativeWebView.postMessage(JSON.stringify({tipo:'semCandidato'}));
        }
      }
      setInterval(verificar, 500);
      document.addEventListener('loadedmetadata', verificar, true);
      document.addEventListener('play', verificar, true);
      verificar();
    })();
    true;
  `;
  function urlVideoValida(valor: string) {
    try {
      const u = new URL(valor);
      return (
        u.protocol === "https:" &&
        !!plataforma &&
        (pertence(u.hostname, plataforma.cdns) ||
          (usarFastDL && pertence(u.hostname, ["fastdl.app"])))
      );
    } catch {
      return false;
    }
  }
  async function salvarNaGaleria(uri: string) {
    try {
      const configuracao = await AsyncStorage.getItem(
        "@TikDownload:salvarGaleria",
      );
      if (configuracao === "false") {
        return;
      }
      const permissao = await MediaLibrary.requestPermissionsAsync(true);
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
      if (redeDireta && dados.tipo === "semCandidato") {
        setVideoDetectado(null);
        return;
      }
      if (redeDireta && dados.tipo === "candidato") {
        if (typeof dados.url === "string" && urlVideoValida(dados.url)) {
          setVideoDetectado(dados.url);
          setTipoDetectado(story && dados.midia === "foto" ? "foto" : "video");
        }
        return;
      }
      if (dados.tipo === "verificacao") {
        setMostrarSite(true);
        return;
      }
      if (
        (dados.tipo !== "video" && !(story && dados.tipo === "foto")) ||
        typeof dados.url !== "string" ||
        !dados.url.startsWith("https://") ||
        (redeDireta && !urlVideoValida(dados.url)) ||
        recebido.current
      ) {
        return;
      }
      recebido.current = true;
      const foto = story && dados.tipo === "foto";
      const nome = `${story ? "Instagram_Story" : (plataforma?.nome ?? "TikTok")}_${Date.now()}.${foto ? "jpg" : "mp4"}`;
      downloadId = iniciarDownload(nome);
      const id = downloadId;
      const pasta =
        FileSystem.documentDirectory + (foto ? "status/" : "videos/");
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
              progresso: Math.min(99, Math.round(percentual)),
              tamanho: progresso.totalBytesWritten,
            });
            console.log("Baixando:", percentual.toFixed(0) + "%");
          }
        },
      );
      // Abre nossa aba Downloads antes da conclusão.
      router.replace("/(tabs)/downloads");
      const resultado = await download.downloadAsync();
      if (!resultado || resultado.status !== 200) {
        throw new Error("Falha no download.");
      }
      const arquivo = await FileSystem.getInfoAsync(resultado.uri);
      if (!arquivo.exists || !arquivo.size) {
        throw new Error("Arquivo inválido.");
      }
      const assinatura = await FileSystem.readAsStringAsync(destino, {
        encoding: FileSystem.EncodingType.Base64,
        position: foto ? 0 : 4,
        length: foto ? 3 : 4,
      });
      if (assinatura !== (foto ? "/9j/" : "ZnR5cA==")) {
        throw new Error(
          foto
            ? "A imagem recebida não é JPEG."
            : "O arquivo recebido não é um MP4 válido.",
        );
      }
      concluirDownload(id, resultado.uri, arquivo.size);
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
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={25} color="#075985" />
        </Pressable>
        <Text style={styles.title}>{plataforma?.nome ?? "SocialDownload"}</Text>
      </View>
      <View style={styles.browserContainer}>
        <WebView
          source={{
            uri: usarFastDL
              ? "https://fastdl.app/pt"
              : redeDireta
                ? endereco
                : "https://ssstik.io/",
          }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          allowsInlineMediaPlayback
          onLoadStart={() => {
            if (redeDireta) setVideoDetectado(null);
          }}
          injectedJavaScript={
            usarFastDL
              ? scriptFastDL
              : redeDireta
                ? scriptRedeSocial
                : scriptTikTok
          }
          onShouldStartLoadWithRequest={(request) => {
            if (usarFastDL) {
              try {
                const url = new URL(request.url);
                if (urlVideoValida(url.href) && url.pathname.toLowerCase().endsWith(".mp4")) {
                  void receberMensagem(JSON.stringify({ tipo: "video", url: url.href }));
                  return false;
                }
                return (
                  url.protocol === "https:" &&
                  pertence(url.hostname, ["fastdl.app"])
                );
              } catch {
                return false;
              }
            }
            if (!redeDireta) return true;
            try {
              const u = new URL(request.url);
              return (
                u.protocol === "https:" &&
                !!plataforma &&
                pertence(u.hostname, plataforma.dominios)
              );
            } catch {
              return false;
            }
          }}
          onMessage={(event) => {
            void receberMensagem(event.nativeEvent.data);
          }}
        />
        {redeDireta && !usarFastDL && (
          <View style={{ padding: 12, backgroundColor: "#E6F4FE" }}>
            <Text style={styles.processingText}>
              {videoDetectado
                ? "Mídia detectada. Salve apenas conteúdo autorizado."
                : "Reproduza o vídeo. Se o botão continuar desativado, não foi encontrado um arquivo direto disponível."}
            </Text>
            <Pressable
              disabled={!videoDetectado}
              style={[
                styles.manualButton,
                { marginTop: 8, opacity: videoDetectado ? 1 : 0.5 },
              ]}
              onPress={() => {
                if (videoDetectado)
                  void receberMensagem(
                    JSON.stringify({
                      tipo: tipoDetectado,
                      url: videoDetectado,
                    }),
                  );
              }}
            >
              <Ionicons name="download-outline" size={20} color="#075985" />
              <Text style={styles.manualText}>
                {story
                  ? tipoDetectado === "foto"
                    ? "Salvar foto"
                    : "Salvar Story"
                  : "Salvar vídeo"}
              </Text>
            </Pressable>
          </View>
        )}
        {(!redeDireta || usarFastDL) && !mostrarSite && (
          <View style={styles.processingScreen}>
            <View style={styles.processingCard}>
              <Ionicons
                name="cloud-download-outline"
                size={65}
                color="#075985"
              />
              <Text style={styles.processingTitle}>Processando vídeo</Text>
              <ActivityIndicator
                size="large"
                color="#075985"
                style={styles.loading}
              />
              <Text style={styles.processingText}>
                Localizando o arquivo de vídeo.
              </Text>
              <Text style={styles.waitText}>Aguarde alguns instantes...</Text>
              <Pressable
                style={styles.manualButton}
                onPress={() => setMostrarSite(true)}
              >
                <Ionicons name="globe-outline" size={18} color="#075985" />
                <Text style={styles.manualText}>Abrir página de download</Text>
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
