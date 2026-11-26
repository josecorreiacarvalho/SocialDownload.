import { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, Image, Modal, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FS from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library/legacy";
import * as Sharing from "expo-sharing";
import { useVideoPlayer, VideoView } from "expo-video";
import AlertaPersonalizado from "../../components/AlertaPersonalizado";

import { carregarDownloads, iniciarDownload, concluirDownload, falharDownload } from "../../downloadStorage";

const KEY = "@SocialDownload:statusPasta";
const SAF = FS.StorageAccessFramework;
type Midia = { uri: string; nome: string; video: boolean };
type Filtro = "Fotos" | "Vídeos";

function VideoStatus({ uri, reproduzir = false }: { uri: string; reproduzir?: boolean }) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = !reproduzir;
    if (reproduzir) p.play();
    else p.pause();
  });
  return <VideoView player={player} style={reproduzir ? styles.preview : styles.thumbnail} nativeControls={reproduzir} contentFit={reproduzir ? "contain" : "cover"} />;
}

export default function StatusScreen() {
  const [midias, setMidias] = useState<Midia[]>([]);
  const [pasta, setPasta] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("Fotos");
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("Autorize a pasta .Statuses do WhatsApp.");
  const [selecionado, setSelecionado] = useState<Midia | null>(null);
  const [alerta, setAlerta] = useState<{ titulo: string; mensagem: string } | null>(null);
  const trava = useRef(false);

  const carregar = useCallback(async (escolher = false) => {
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    try {
      let uri = await AsyncStorage.getItem(KEY);
      if (escolher) {
        const permissao = await SAF.requestDirectoryPermissionsAsync();
        if (!permissao.granted) return;
        uri = permissao.directoryUri;
        const caminho = decodeURIComponent(uri).replace(/\/$/, "");
        if (!caminho.endsWith("/.Statuses")) {
          setAlerta({ titulo: "Pasta incorreta", mensagem: "Selecione a pasta .Statuses dentro de WhatsApp/Media." });
          return;
        }
      }
      if (!uri) return;
      const itens = await SAF.readDirectoryAsync(uri);
      const lista = itens.map((item) => {
        const nome = decodeURIComponent(item).split("/").pop() || "";
        return { uri: item, nome, video: /\.mp4$/i.test(nome) };
      }).filter((item) => /\.(jpg|jpeg|png|webp|mp4)$/i.test(item.nome));
      await AsyncStorage.setItem(KEY, uri);
      setPasta(uri);
      setMidias(lista);
      setMensagem(lista.length ? `${lista.length} arquivo(s) encontrado(s).` : "Nenhum Status encontrado. Visualize alguns no WhatsApp e atualize.");
    } catch {
      setMensagem("Não foi possível ler a pasta. Autorize o acesso novamente.");
      setMidias([]);
      setPasta(null);
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void carregar(); }, [carregar]));

  async function executar(item: Midia, acao: "salvar" | "compartilhar") {
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    let destino: string | null = null;
    let id: string | null = null;
    let concluido = false;
    try {
      if (!FS.cacheDirectory) throw new Error("Cache indisponível.");
      const extensao = item.nome.split(".").pop()?.toLowerCase() || (item.video ? "mp4" : "jpg");
      const nome = `Status_${Date.now()}.${extensao}`;
      if (acao === "salvar") {
        if (!FS.documentDirectory) throw new Error("Armazenamento indisponível.");
        await carregarDownloads();
        id = iniciarDownload(nome);
        const pastaSalvos = `${FS.documentDirectory}status/`;
        await FS.makeDirectoryAsync(pastaSalvos, { intermediates: true });
        destino = `${pastaSalvos}${nome}`;
      } else {
        destino = `${FS.cacheDirectory}${nome}`;
      }
      await FS.copyAsync({ from: item.uri, to: destino });
      if (acao === "salvar") {
        const permissao = await MediaLibrary.requestPermissionsAsync(true);
        if (!permissao.granted) throw new Error("Permissão para salvar na galeria não concedida.");
        const info = await FS.getInfoAsync(destino);
        if (!info.exists || info.isDirectory || !info.size) throw new Error("Arquivo inválido.");
        await MediaLibrary.saveToLibraryAsync(destino);
        if (id) concluirDownload(id, destino, info.size);
        concluido = true;
        setAlerta({ titulo: "Status salvo", mensagem: "Arquivo salvo na galeria do celular." });
      } else {
        if (!(await Sharing.isAvailableAsync())) throw new Error("Compartilhamento indisponível.");
        await Sharing.shareAsync(destino, { mimeType: item.video ? "video/mp4" : extensao === "jpg" || extensao === "jpeg" ? "image/jpeg" : `image/${extensao}` });
      }
    } catch (erro) {
      if (id) falharDownload(id, erro instanceof Error ? erro.message : "Tente novamente.");
      setAlerta({ titulo: "Não foi possível concluir", mensagem: erro instanceof Error ? erro.message : "Tente novamente." });
    } finally {
      if (destino && !concluido) await FS.deleteAsync(destino, { idempotent: true }).catch(() => {});
      trava.current = false;
      setOcupado(false);
    }
  }

  const lista = midias.filter((m) => filtro === "Vídeos" ? m.video : !m.video);

  return (
    <View style={styles.container}>
      <Ionicons name="logo-whatsapp" size={48} color="#075985" style={styles.headerIcon} />
      <Text style={styles.title}>Status</Text>
      <Text style={styles.subtitle}>Salve fotos e vídeos do WhatsApp</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="folder-open-outline" size={24} color="#075985" />
          <Text style={styles.cardTitle}>Status do WhatsApp</Text>
        </View>
        <Text style={styles.description}>{mensagem}</Text>
        <View style={styles.row}>
          <Pressable disabled={ocupado} style={[styles.button, { flex: 1 }]} onPress={() => carregar(!pasta)}>
            {ocupado ? <ActivityIndicator color="#FFF" /> : <Ionicons name={pasta ? "refresh" : "folder-outline"} size={19} color="#FFF" />}
            <Text style={styles.buttonText}>{pasta ? "Atualizar" : "Acessar Status"}</Text>
          </Pressable>
          {pasta && <Pressable disabled={ocupado} style={styles.folderButton} onPress={() => carregar(true)} accessibilityLabel="Alterar pasta"><Ionicons name="folder-open-outline" size={23} color="#075985" /></Pressable>}
        </View>
      </View>
      <View style={styles.filters}>
        {(["Fotos", "Vídeos"] as Filtro[]).map((f) => <Pressable key={f} onPress={() => setFiltro(f)} style={[styles.filter, filtro === f && styles.filterActive]}><Text style={[styles.filterText, filtro === f && { color: "#FFF" }]}>{f}</Text></Pressable>)}
      </View>
      <FlatList style={styles.list} contentContainerStyle={{ paddingBottom: 10 }} data={lista} keyExtractor={(m) => m.uri} numColumns={2} columnWrapperStyle={{ gap: 10 }} showsVerticalScrollIndicator={false} initialNumToRender={6} maxToRenderPerBatch={4} windowSize={3}
        renderItem={({ item }) => <View style={styles.mediaCard}>
          <Pressable onPress={() => setSelecionado(item)} style={styles.mediaBox}>
            {item.video ? <VideoStatus uri={item.uri} /> : <Image source={{ uri: item.uri }} style={styles.thumbnail} resizeMode="cover" />}
            {item.video && <View style={styles.play}><Ionicons name="play-circle" size={36} color="#FFF" /></View>}
          </Pressable>
          <View style={styles.actions}>
            <Pressable disabled={ocupado} style={styles.action} onPress={() => executar(item, "salvar")}><Ionicons name="download-outline" size={20} color="#075985" /><Text style={styles.actionText}>Salvar</Text></Pressable>
            <Pressable disabled={ocupado} style={styles.action} onPress={() => executar(item, "compartilhar")}><Ionicons name="share-social-outline" size={20} color="#075985" /><Text style={styles.actionText}>Enviar</Text></Pressable>
          </View>
        </View>}
      />
      <Modal visible={selecionado !== null} animationType="fade" onRequestClose={() => setSelecionado(null)}>
        {selecionado && <View style={styles.modal}>
          <Pressable style={styles.close} onPress={() => setSelecionado(null)}><Ionicons name="close-circle-outline" size={36} color="#FFF" /></Pressable>
          {selecionado.video ? <VideoStatus key={selecionado.uri} uri={selecionado.uri} reproduzir /> : <Image source={{ uri: selecionado.uri }} style={styles.preview} resizeMode="contain" />}
          <View style={styles.row}>
            <Pressable style={[styles.button, { flex: 1 }]} disabled={ocupado} onPress={() => { const item = selecionado; setSelecionado(null); void executar(item, "salvar"); }}><Text style={styles.buttonText}>Salvar</Text></Pressable>
            <Pressable style={[styles.button, { flex: 1 }]} disabled={ocupado} onPress={() => { const item = selecionado; setSelecionado(null); void executar(item, "compartilhar"); }}><Text style={styles.buttonText}>Compartilhar</Text></Pressable>
          </View>
        </View>}
      </Modal>
      <AlertaPersonalizado visivel={alerta !== null} titulo={alerta?.titulo || ""} mensagem={alerta?.mensagem || ""} aoFechar={() => setAlerta(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 45, paddingHorizontal: 14 },
  headerIcon: { alignSelf: "center", marginBottom: 10 },
  title: { fontFamily: "Poppins_700Bold", fontSize: 30, color: "#183B56", textAlign: "center", textShadowColor: "#91B5CA", textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 2 },
  subtitle: { fontFamily: "Poppins_400Regular", fontSize: 12, color: "#475569", textAlign: "center", marginBottom: 22 },
  card: { backgroundColor: "rgba(255,255,255,0.45)", borderWidth: 1, borderColor: "rgba(100,130,160,0.40)", borderRadius: 24, padding: 15, marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 16, color: "#183B56" },
  description: { fontFamily: "Poppins_400Regular", fontSize: 12, color: "#334155", marginVertical: 8 },
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#17658F", borderRadius: 12, paddingVertical: 12, gap: 8 },
  buttonText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: "#FFF" },
  folderButton: { padding: 10, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.45)", borderWidth: 1, borderColor: "#91B5CA" },
  filters: { flexDirection: "row", gap: 8, marginBottom: 10 },
  filter: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.45)", borderWidth: 1, borderColor: "rgba(100,130,160,0.40)" },
  filterActive: { backgroundColor: "#17658F" },
  filterText: { fontFamily: "Poppins_500Medium", fontSize: 12, color: "#183B56" },
  list: { flex: 1, marginBottom: 70 },
  mediaCard: { flex: 1, maxWidth: "50%", backgroundColor: "rgba(255,255,255,0.45)", borderWidth: 1, borderColor: "rgba(100,130,160,0.40)", borderRadius: 16, padding: 6, marginBottom: 10 },
  mediaBox: { aspectRatio: 1, borderRadius: 11, overflow: "hidden", backgroundColor: "#DCE7EF" },
  thumbnail: { width: "100%", height: "100%" },
  play: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", gap: 4, marginTop: 6 },
  action: { flex: 1, alignItems: "center", paddingVertical: 4, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.45)" },
  actionText: { fontFamily: "Poppins_500Medium", fontSize: 10, color: "#183B56" },
  modal: { flex: 1, backgroundColor: "#101820", padding: 14, paddingTop: 40, paddingBottom: 30 },
  close: { alignSelf: "flex-end", padding: 5 },
  preview: { flex: 1, width: "100%", marginVertical: 10 },
});
