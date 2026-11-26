import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  Modal,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { carregarDownloads, obterDownloads, atualizarDownload } from "../../downloadStorage";

import AlertaPersonalizado from "../../components/AlertaPersonalizado";

const BLUE = "#075985";
const DARK = "#183B56";

const PASTA = FileSystem.documentDirectory + "videos/";

type VideoItem = {
  nome: string;
  uri: string;
  tamanho: number;
  data: number;
};

function Miniatura({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (player) => {
    player.muted = true;
    player.pause();
  });

  return (
    <View style={styles.thumbnail}>
      <VideoView
        player={player}
        style={styles.thumbnailVideo}
        nativeControls={false}
        contentFit="cover"
      />

      <View pointerEvents="none" style={styles.playOverlay}>
        <Ionicons name="play-circle" size={32} color="#FFFFFF" />
      </View>
    </View>
  );
}

function Reprodutor({
  video,
  fechar,
}: {
  video: VideoItem;
  fechar: () => void;
}) {
  const player = useVideoPlayer(video.uri, (player) => {
    player.play();
  });

  return (
    <Modal visible animationType="fade" transparent onRequestClose={fechar}>
      <View style={styles.modalBackground}>
        <View style={styles.playerCard}>
          <View style={styles.playerHeader}>
            <Text style={styles.playerTitle}>Reproduzir vídeo</Text>

            <Pressable onPress={fechar} hitSlop={10}>
              <Ionicons name="close-circle-outline" size={28} color={BLUE} />
            </Pressable>
          </View>

          <VideoView
            player={player}
            style={styles.playerVideo}
            nativeControls
            contentFit="contain"
          />

          <Text style={styles.playerName} numberOfLines={2}>
            {video.nome}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

export default function VideosScreen() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [selecionado, setSelecionado] = useState<VideoItem | null>(null);

  const [renomeando, setRenomeando] = useState<VideoItem | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [alerta, setAlerta] = useState<{
    titulo: string;
    mensagem: string;
    confirmar?: () => void;
  } | null>(null);
  const [erroNome, setErroNome] = useState("");

  function mostrarAlerta(titulo: string, mensagem: string) {
    setAlerta({ titulo, mensagem });
  }


  const carregarVideos = useCallback(async () => {
    try {
      const pasta = await FileSystem.getInfoAsync(PASTA);

      if (!pasta.exists) {
        setVideos([]);
        return;
      }

      const arquivos = await FileSystem.readDirectoryAsync(PASTA);

      const lista: VideoItem[] = [];

      for (const nome of arquivos) {
        if (!nome.toLowerCase().endsWith(".mp4")) {
          continue;
        }

        const uri = PASTA + nome;

        const info = await FileSystem.getInfoAsync(uri);

        if (info.exists && !info.isDirectory) {
          lista.push({
            nome,
            uri,
            tamanho: info.size ?? 0,
            data: (info.modificationTime ?? 0) * 1000,
          });
        }
      }

      lista.sort((a, b) => b.data - a.data);

      setVideos(lista);
    } catch (erro) {
      console.log("ERRO AO CARREGAR VÍDEOS:", erro);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregarVideos();
    }, [carregarVideos]),
  );

  function formatarTamanho(bytes: number) {
    if (bytes === 0) return "0 MB";

    return (bytes / 1024 / 1024).toFixed(2) + " MB";
  }

  function formatarData(data: number) {
    if (!data) return "";

    return new Date(data).toLocaleDateString("pt-BR");
  }

  async function compartilhar(video: VideoItem) {
    try {
      const disponivel = await Sharing.isAvailableAsync();

      if (!disponivel) {
        mostrarAlerta("Compartilhar", "Compartilhamento indisponível.");
        return;
      }

      await Sharing.shareAsync(video.uri, {
        mimeType: "video/mp4",
        dialogTitle: "Compartilhar vídeo",
      });
    } catch {
      mostrarAlerta("Compartilhar", "Não foi possível compartilhar o vídeo.");
    }
  }

  function excluir(video: VideoItem) {
    setAlerta({
      titulo: "Excluir vídeo",
      mensagem: "Deseja excluir este vídeo permanentemente?",
      confirmar: () => {
        void (async () => {
          try {
            await FileSystem.deleteAsync(video.uri, { idempotent: true });
            await carregarVideos();
          } catch {
            mostrarAlerta("Erro", "Não foi possível excluir o vídeo.");
          }
        })();
      },
    });
  }

  function abrirRenomear(video: VideoItem) {
    setErroNome("");
    setNovoNome(video.nome.replace(/\\.mp4$/i, ""));
    setRenomeando(video);
  }

  async function salvarNome() {
    if (!renomeando || salvando) return;
    setErroNome("");
    const base = novoNome.trim().replace(/\\.mp4$/i, "").trim();
    if (!base || base === "." || base === ".." || /[\\\/:*?"<>|%#\x00-\x1f]/.test(base)) {
      setErroNome("Digite um nome válido, sem caracteres especiais de arquivo.");
      return;
    }
    const nome = base + ".mp4";
    if (nome === renomeando.nome) {
      setRenomeando(null);
      return;
    }
    const destino = PASTA + nome;
    setSalvando(true);
    try {
      await carregarDownloads();
      const existente = await FileSystem.getInfoAsync(destino);
      if (existente.exists) {
        setErroNome("Já existe um vídeo com esse nome.");
        return;
      }
      await FileSystem.moveAsync({ from: renomeando.uri, to: destino });
      for (const item of obterDownloads()) {
        if (item.uri === renomeando.uri) {
          atualizarDownload(item.id, { nome, uri: destino, status: "concluido" });
        }
      }
      setRenomeando(null);
      await carregarVideos();
    } catch {
      setErroNome("Não foi possível renomear o vídeo.");
    } finally {
      setSalvando(false);
    }
  }

  const tamanhoTotal = videos.reduce(
    (total, video) => total + video.tamanho,
    0,
  );


 return (
  <View style={styles.container}>
    <View style={styles.fixedHeader}>
        <View style={styles.headerIcon}>
          <Ionicons name="videocam-outline" size={40} color={BLUE} />
        </View>

        <Text style={styles.title}>Vídeos</Text>

        <Text style={styles.subtitle}>Sua biblioteca de vídeos</Text>

        </View>

<ScrollView
  style={styles.scroll}
  contentContainerStyle={styles.content}
  showsVerticalScrollIndicator={false}
  keyboardShouldPersistTaps="handled"
>

        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Ionicons name="film-outline" size={26} color={BLUE} />

            <Text style={styles.number}>{videos.length}</Text>

            <Text style={styles.label}>Vídeos salvos</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryItem}>
            <Ionicons name="folder-open-outline" size={26} color={BLUE} />

            <Text style={styles.number}>{formatarTamanho(tamanhoTotal)}</Text>

            <Text style={styles.label}>Espaço ocupado</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="albums-outline" size={24} color={BLUE} />

            <Text style={styles.cardTitle}>Meus vídeos</Text>
          </View>

          {videos.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="film-outline" size={48} color="#54758A" />

              <Text style={styles.emptyTitle}>
                Nenhum vídeo salvo
              </Text>

              <Text style={styles.emptyText}>
                Seus vídeos baixados aparecerão aqui.
              </Text>
            </View>
          ) : (
            videos.map((video) => (
              <View key={video.uri} style={styles.videoCard}>
                <Pressable
                  style={styles.videoRow}
                  onPress={() => setSelecionado(video)}
                  accessibilityLabel="Reproduzir vídeo"
                >
                  <Miniatura uri={video.uri} />

                  <View style={styles.videoInfo}>
                    <Text style={styles.videoName} numberOfLines={1} ellipsizeMode="middle">
                      {video.nome}
                    </Text>

                    <Text style={styles.videoDetails}>
                      {formatarTamanho(video.tamanho)}
                    </Text>

                    <Text style={styles.videoDetails}>
                      {formatarData(video.data)}
                    </Text>
                  </View>
                </Pressable>

                <View style={styles.actions}>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => setSelecionado(video)}
                    accessibilityLabel="Reproduzir"
                  >
                    <Ionicons name="play-outline" size={20} color={BLUE} />

                    <Text style={styles.actionText}>Reproduzir</Text>
                  </Pressable>

                  <Pressable
                    style={styles.actionButton}
                    onPress={() => abrirRenomear(video)}
                    accessibilityLabel="Renomear"
                  >
                    <Ionicons name="pencil-outline" size={20} color={BLUE} />
                    <Text style={styles.actionText}>Renomear</Text>
                  </Pressable>

                  <Pressable
                    style={styles.actionButton}
                    onPress={() => compartilhar(video)}
                    accessibilityLabel="Compartilhar"
                  >
                    <Ionicons
                      name="share-social-outline"
                      size={20}
                      color={BLUE}
                    />

                    <Text style={styles.actionText}>Compartilhar</Text>
                  </Pressable>

                  <Pressable
                    style={styles.actionButton}
                    onPress={() => excluir(video)}
                    accessibilityLabel="Excluir"
                  >
                    <Ionicons name="trash-outline" size={20} color="#B91C1C" />

                    <Text style={styles.deleteText}>Excluir</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {renomeando && (
        <Modal transparent visible animationType="fade" onRequestClose={() => { if (!salvando) setRenomeando(null); }}>
          <View style={styles.modalBackground}>
            <View style={styles.playerCard}>
              <Text style={styles.playerTitle}>Renomear vídeo</Text>
              <TextInput
                style={styles.renameInput}
                value={novoNome}
                onChangeText={(texto) => { setNovoNome(texto); setErroNome(""); }}
                editable={!salvando}
                maxLength={100}
                autoCorrect={false}
                selectTextOnFocus
                placeholder="Nome do vídeo"
                placeholderTextColor="#64748B"
              />
              <Text style={styles.videoDetails}>A extensão .mp4 será mantida.</Text>
                {!!erroNome && <Text style={styles.renameError}>{erroNome}</Text>}
              <View style={styles.actions}>
                <Pressable disabled={salvando} style={styles.actionButton} onPress={() => setRenomeando(null)}>
                  <Text style={styles.renameButtonText}>Cancelar</Text>
                </Pressable>
                <Pressable disabled={salvando} style={styles.actionButton} onPress={() => void salvarNome()}>
                  <Text style={styles.renameButtonText}>{salvando ? "Salvando..." : "Salvar"}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      <AlertaPersonalizado
        visivel={alerta !== null}
        titulo={alerta?.titulo ?? ""}
        mensagem={alerta?.mensagem ?? ""}
        icone={alerta?.confirmar ? "trash-outline" : "alert-circle-outline"}
        destrutivo={!!alerta?.confirmar}
        textoConfirmar={alerta?.confirmar ? "Excluir" : "OK"}
        aoFechar={() => setAlerta(null)}
        aoConfirmar={alerta?.confirmar}
      />

      {selecionado && (
        <Reprodutor video={selecionado} fechar={() => setSelecionado(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

fixedHeader: {
  paddingTop: 25,
  paddingHorizontal: 14,
},

scroll: {
  flex: 1,
  marginBottom: 64,
},

content: {
  paddingTop: 0,
  paddingHorizontal: 14,
  paddingBottom: 10,
},

  headerIcon: {
    alignSelf: "center",
    marginBottom: 4,
    transform: [{ translateY: 9 }],
  },

  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 30,
    color: DARK,
    textAlign: "center",
    textShadowColor: "#91B5CA",
    textShadowOffset: {
      width: 1,
      height: 2,
    },
    textShadowRadius: 2,
  },

  subtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: "#475569",
    textAlign: "center",
    marginBottom: 8,
  },

  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.45)",
    borderWidth: 1,
    borderColor: "rgba(100,130,160,0.40)",
    borderRadius: 22,
    paddingVertical: 6,
    paddingHorizontal: 5,
    marginBottom: 8,
  },

  summaryItem: {
    flex: 1,
    alignItems: "center",
    gap: 3,
  },

  number: {
    fontFamily: "Poppins_700Bold",
    fontSize: 23,
    color: DARK,
  },

  label: {
    fontFamily: "Poppins_500Medium",
    fontSize: 10,
    color: DARK,
  },

  divider: {
    width: 1,
    height: 48,
    backgroundColor: "rgba(100,130,160,0.30)",
  },

card: {
  backgroundColor: "transparent",
  padding: 0,
  marginBottom: 0,
},

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  cardTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: DARK,
  },

  emptyContainer: {
    alignItems: "center",
    paddingVertical: 25,
    gap: 7,
  },

  emptyTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: DARK,
  },

  emptyText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: "#475569",
    textAlign: "center",
  },

videoCard: {
  backgroundColor: "rgba(255,255,255,0.45)",
  borderWidth: 1,
  borderColor: "rgba(100,130,160,0.40)",
  borderRadius: 18,
  padding: 8,
  marginTop: 15,
},

  videoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  thumbnail: {
    width: 75,
    height: 75,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#DCEAF3",
  },

  thumbnailVideo: {
    width: "100%",
    height: "100%",
  },

  playOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.12)",
  },

  videoInfo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },

  videoName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: DARK,
  },

  videoDetails: {
    fontFamily: "Poppins_400Regular",
    fontSize: 10,
    color: "#475569",
  },

  actions: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },

  actionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(100,130,160,0.30)",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.35)",
  },

  actionText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 9,
    color: BLUE,
  },

  deleteText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 9,
    color: "#B91C1C",
  },

  renameError: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: "#B91C1C",
    marginTop: 8,
  },

  renameInput: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: DARK,
    borderWidth: 1,
    borderColor: "#91B5CA",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: 12,
    backgroundColor: "rgba(255,255,255,0.45)",
  },

  renameButtonText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: BLUE,
    paddingVertical: 5,
  },

  modalBackground: {
    flex: 1,
    justifyContent: "center",
    padding: 14,
    backgroundColor: "rgba(15,30,45,0.45)",
  },

  playerCard: {
    backgroundColor: "rgba(240,248,255,0.96)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#91B5CA",
    padding: 12,
  },

  playerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  playerTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: DARK,
  },

  playerVideo: {
    width: "100%",
    height: 400,
    backgroundColor: "#000000",
    borderRadius: 12,
  },

  playerName: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: DARK,
    textAlign: "center",
    marginTop: 12,
  },
});
