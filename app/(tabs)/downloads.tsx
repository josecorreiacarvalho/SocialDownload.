import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname } from "expo-router";
import AlertaPersonalizado from "../../components/AlertaPersonalizado";
import { obterDownloads, observarDownloads, removerDownload } from "../../downloadStorage";

const BLUE = "#075985";
const DARK = "#183B56";

export default function DownloadsScreen() {
  const downloads = useSyncExternalStore(observarDownloads, obterDownloads, obterDownloads);
  const pathname = usePathname();
  const isFocused = pathname === "/downloads";
  const downloadsAtivos = useRef(new Set<string>());
  const falhasNotificadas = useRef(new Set<string>());
  const [avisos, setAvisos] = useState<string[]>([]);
  const [excluirId, setExcluirId] = useState<string | null>(null);

  useEffect(() => {
    const novasFalhas: string[] = [];
    for (const item of downloads) {
      if (item.status === "baixando") downloadsAtivos.current.add(item.id);
      if (item.status === "falha" && downloadsAtivos.current.has(item.id) && !falhasNotificadas.current.has(item.id)) {
        falhasNotificadas.current.add(item.id);
        novasFalhas.push(item.erro || "Não foi possível baixar o vídeo.");
      }
      if (item.status !== "baixando") downloadsAtivos.current.delete(item.id);
    }
    if (novasFalhas.length) setAvisos(anteriores => [...anteriores, ...novasFalhas]);
  }, [downloads]);

  const baixando = downloads.filter(item => item.status === "baixando").length;
  const concluidos = downloads.filter(item => item.status === "concluido").length;
  const falhas = downloads.filter(item => item.status === "falha").length;
  const formatarTamanho = (bytes: number) => (bytes / 1024 / 1024).toFixed(2) + " MB";

  return (
    <View style={styles.container}>
      <View style={styles.fixedHeader}>
        <View style={styles.headerIcon}><Ionicons name="cloud-download-outline" size={48} color={BLUE} /></View>
        <Text style={styles.title}>Downloads</Text>
        <Text style={styles.subtitle}>Acompanhe seus downloads</Text>
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Ionicons name="download-outline" size={25} color={BLUE} />
            <Text style={styles.number}>{baixando}</Text><Text style={styles.label}>Baixando</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryItem}>
            <Ionicons name="checkmark-circle-outline" size={25} color={BLUE} />
            <Text style={styles.number}>{concluidos}</Text><Text style={styles.label}>Concluídos</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryItem}>
            <Ionicons name="alert-circle-outline" size={25} color={BLUE} />
            <Text style={styles.number}>{falhas}</Text><Text style={styles.label}>Falhas</Text>
          </View>
        </View>
        <View style={styles.cardHeader}>
          <Ionicons name="list-outline" size={24} color={BLUE} />
          <Text style={styles.cardTitle}>Fila de downloads</Text>
        </View>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {downloads.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cloud-download-outline" size={45} color="#54758A" />
            <Text style={styles.emptyTitle}>Nenhum download</Text>
            <Text style={styles.emptyText}>Os vídeos que você baixar aparecerão aqui.</Text>
          </View>
        ) : downloads.map(item => (
          <View key={item.id} style={styles.downloadCard}>
            <View style={styles.downloadRow}>
              <View style={styles.videoIcon}><Ionicons name="videocam-outline" size={27} color={BLUE} /></View>
              <View style={styles.downloadInfo}>
                <Text style={styles.downloadName} numberOfLines={1}>{item.nome}</Text>
                <Text style={styles.downloadStatus}>{item.status === "baixando" ? "Baixando vídeo..." : item.status === "concluido" ? "Download concluído" : "Falha no download"}</Text>
                {item.status === "concluido" && <Text style={styles.fileSize}>{formatarTamanho(item.tamanho)}</Text>}
              </View>
              <Ionicons name={item.status === "concluido" ? "checkmark-circle-outline" : item.status === "falha" ? "alert-circle-outline" : "cloud-download-outline"} size={25} color={item.status === "concluido" ? "#15803D" : item.status === "falha" ? "#B91C1C" : BLUE} />
              {item.status !== "baixando" && (
                <Pressable style={styles.deleteButton} onPress={() => setExcluirId(item.id)} accessibilityRole="button" accessibilityLabel="Remover da fila">
                  <Ionicons name="trash-outline" size={22} color="#B91C1C" />
                </Pressable>
              )}
            </View>
            {item.status !== "falha" && (
              <View style={styles.progressRow}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, item.progresso))}%`, backgroundColor: item.status === "concluido" ? "#15803D" : BLUE }]} />
                </View>
                <Text style={styles.progressText}>{Math.round(item.progresso)}%</Text>
              </View>
            )}
            {item.status === "falha" && <Text style={styles.errorText}>{item.erro || "Não foi possível baixar o vídeo."}</Text>}
          </View>
        ))}
      </ScrollView>
      <AlertaPersonalizado visivel={isFocused && avisos.length > 0} titulo="Erro no download" mensagem={avisos[0] ?? ""} icone="alert-circle-outline" aoFechar={() => setAvisos(anteriores => anteriores.slice(1))} />
      <AlertaPersonalizado
        visivel={isFocused && excluirId !== null && avisos.length === 0}
        titulo="Remover da fila?"
        mensagem="O registro será removido da fila de downloads. O vídeo salvo não será excluído."
        icone="trash-outline"
        textoConfirmar="Remover"
        textoCancelar="Cancelar"
        destrutivo
        aoFechar={() => setExcluirId(null)}
        aoConfirmar={() => {
          const item = obterDownloads().find(item => item.id === excluirId);
          if (item && item.status !== "baixando") removerDownload(item.id);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fixedHeader: { paddingTop: 45, paddingHorizontal: 14 },
  scroll: { flex: 1, marginBottom: 65, overflow: "hidden" },
  content: { paddingTop: 0, paddingHorizontal: 14, paddingBottom: 10 },
  headerIcon: { alignSelf: "center", marginBottom: 10 },
  title: { fontFamily: "Poppins_700Bold", fontSize: 30, color: DARK, textAlign: "center", textShadowColor: "#91B5CA", textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 2 },
  subtitle: { fontFamily: "Poppins_400Regular", fontSize: 12, color: "#475569", textAlign: "center", marginBottom: 22 },
  summaryCard: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.45)", borderWidth: 1, borderColor: "rgba(100,130,160,0.40)", borderRadius: 22, paddingVertical: 14, paddingHorizontal: 5, marginBottom: 12 },
  summaryItem: { flex: 1, alignItems: "center", gap: 3 },
  number: { fontFamily: "Poppins_700Bold", fontSize: 23, color: DARK },
  label: { fontFamily: "Poppins_500Medium", fontSize: 10, color: DARK },
  divider: { width: 1, height: 55, backgroundColor: "rgba(100,130,160,0.30)" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 16, color: DARK },
  emptyContainer: { alignItems: "center", paddingVertical: 25, gap: 7 },
  emptyTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: DARK },
  emptyText: { fontFamily: "Poppins_400Regular", fontSize: 11, color: "#475569", textAlign: "center" },
  downloadCard: { backgroundColor: "rgba(255,255,255,0.45)", borderWidth: 1, borderColor: "rgba(100,130,160,0.40)", borderRadius: 18, padding: 12, marginTop: 26 },
  downloadRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  videoIcon: { width: 45, height: 45, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.45)", borderWidth: 1, borderColor: "rgba(100,130,160,0.30)", alignItems: "center", justifyContent: "center" },
  downloadInfo: { flex: 1, minWidth: 0 },
  downloadName: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: DARK },
  downloadStatus: { fontFamily: "Poppins_400Regular", fontSize: 10, color: "#475569" },
  fileSize: { fontFamily: "Poppins_500Medium", fontSize: 10, color: DARK, marginTop: 2 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  progressTrack: { flex: 1, height: 7, borderRadius: 10, backgroundColor: "rgba(100,130,160,0.20)", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 10 },
  progressText: { fontFamily: "Poppins_600SemiBold", fontSize: 11, color: DARK, width: 38, textAlign: "right" },
  errorText: { fontFamily: "Poppins_400Regular", fontSize: 10, color: "#B91C1C", marginTop: 8 },
  deleteButton: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: "rgba(100,130,160,0.30)", backgroundColor: "rgba(255,255,255,0.35)", alignItems: "center", justifyContent: "center" },
});
