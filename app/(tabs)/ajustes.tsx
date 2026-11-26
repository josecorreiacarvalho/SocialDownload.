import { useCallback, useState } from "react";
import { View, Text, Image, Switch, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import AlertaPersonalizado from "../../components/AlertaPersonalizado";

const BLUE = "#075985";
const DARK = "#183B56";

export default function AjustesScreen() {
  const [salvarGaleria, setSalvarGaleria] = useState(true);
  const [somenteWifi, setSomenteWifi] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [espaco, setEspaco] = useState("Calculando...");
  const [alerta, setAlerta] = useState({
    visivel: false,
    titulo: "",
    mensagem: "",
  });

  function mostrarAlerta(titulo: string, mensagem: string) {
    setAlerta({ visivel: true, titulo, mensagem });
  }

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      setCarregando(true);
      setEspaco("Calculando...");

      async function carregar() {
        try {
          const [galeria, wifi] = await Promise.all([
            AsyncStorage.getItem("@TikDownload:salvarGaleria"),
            AsyncStorage.getItem("@TikDownload:somenteWifi"),
          ]);
          if (ativo) {
            setSalvarGaleria(galeria !== "false");
            setSomenteWifi(wifi === "true");
          }
        } catch {
          if (ativo)
            setAlerta({
              visivel: true,
              titulo: "Atenção",
              mensagem: "Não foi possível carregar os ajustes.",
            });
        } finally {
          if (ativo) setCarregando(false);
        }
      }

      async function calcularEspaco() {
        try {
          if (!FileSystem.documentDirectory)
            throw new Error("Pasta indisponível");
          const pasta = FileSystem.documentDirectory + "videos/";
          const info = await FileSystem.getInfoAsync(pasta);
          let total = 0;
          if (info.exists && info.isDirectory) {
            const arquivos = await FileSystem.readDirectoryAsync(pasta);
            for (const nome of arquivos) {
              if (!nome.toLowerCase().endsWith(".mp4")) continue;
              const arquivo = await FileSystem.getInfoAsync(pasta + nome);
              if (arquivo.exists && !arquivo.isDirectory)
                total += arquivo.size ?? 0;
            }
          }
          if (ativo)
            setEspaco(
              total === 0 ? "0 MB" : (total / 1024 / 1024).toFixed(2) + " MB",
            );
        } catch {
          if (ativo) setEspaco("Indisponível");
        }
      }

      void carregar();
      void calcularEspaco();
      return () => {
        ativo = false;
      };
    }, []),
  );

  async function alterarGaleria(valor: boolean) {
    setSalvando(true);
    try {
      await AsyncStorage.setItem("@TikDownload:salvarGaleria", String(valor));
      setSalvarGaleria(valor);
    } catch {
      mostrarAlerta("Erro", "Não foi possível salvar o ajuste.");
    } finally {
      setSalvando(false);
    }
  }

  async function alterarWifi(valor: boolean) {
    setSalvando(true);
    try {
      await AsyncStorage.setItem("@TikDownload:somenteWifi", String(valor));
      setSomenteWifi(valor);
    } catch {
      mostrarAlerta("Erro", "Não foi possível salvar o ajuste.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.fixedHeader}>
        <View style={styles.headerIcon}>
          <Ionicons name="settings-outline" size={48} color={BLUE} />
        </View>
        <Text style={styles.title}>Ajustes</Text>
        <Text style={styles.subtitle}>Personalize seu aplicativo</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="options-outline" size={24} color={BLUE} />
            <Text style={styles.cardTitle}>Preferências</Text>
          </View>
          <View style={styles.settingRow}>
            <Ionicons name="images-outline" size={24} color={BLUE} />
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Salvar na galeria</Text>
              <Text style={styles.settingDescription}>
                Disponibilizar vídeos na galeria
              </Text>
            </View>
            <Switch
              value={salvarGaleria}
              onValueChange={alterarGaleria}
              disabled={carregando || salvando}
              trackColor={{ false: "#B8C5CF", true: "#77B6D5" }}
              thumbColor={salvarGaleria ? BLUE : "#FFFFFF"}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <Ionicons name="wifi-outline" size={24} color={BLUE} />
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Somente Wi-Fi</Text>
              <Text style={styles.settingDescription}>
                Evitar o uso de dados móveis
              </Text>
            </View>
            <Switch
              value={somenteWifi}
              onValueChange={alterarWifi}
              disabled={carregando || salvando}
              trackColor={{ false: "#B8C5CF", true: "#77B6D5" }}
              thumbColor={somenteWifi ? BLUE : "#FFFFFF"}
            />
          </View>
        </View>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="folder-open-outline" size={24} color={BLUE} />
            <Text style={styles.cardTitle}>Armazenamento</Text>
          </View>
          <View style={styles.settingRow}>
            <Ionicons name="film-outline" size={24} color={BLUE} />
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Espaço utilizado</Text>
              <Text style={styles.settingDescription}>
                Armazenamento dos vídeos
              </Text>
            </View>
            <Text style={styles.storageValue}>{espaco}</Text>
          </View>
        </View>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons
              name="information-circle-outline"
              size={24}
              color={BLUE}
            />
            <Text style={styles.cardTitle}>Sobre o aplicativo</Text>
          </View>
          <View style={styles.aboutContainer}>
            <Image
              source={require("../../assets/images/social-logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <View style={styles.settingInfo}>
              <Text style={styles.appName}>SocialDownload</Text>
              <Text style={styles.settingDescription}>
                Versão {Constants.expoConfig?.version ?? "1.0.0"}
              </Text>
              <Text style={styles.settingDescription}>
                Gerenciador de vídeos
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.developerCard}>
          <View style={styles.developerInfo}>
            <Text style={styles.developerLabel}>Desenvolvido por</Text>
            <Text style={styles.developerName}>José C Carvalho</Text>
            <Image
              source={require("../../assets/images/rubrica-dark.png")}
              style={styles.signature}
              resizeMode="contain"
            />
          </View>
          <Image
            source={require("../../assets/images/foto-jose.png")}
            style={styles.photo}
            resizeMode="cover"
          />
        </View>
      </View>
      <AlertaPersonalizado
        visivel={alerta.visivel}
        titulo={alerta.titulo}
        mensagem={alerta.mensagem}
        icone="alert-circle-outline"
        aoFechar={() =>
          setAlerta((anterior) => ({ ...anterior, visivel: false }))
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fixedHeader: { paddingTop: 57, paddingHorizontal: 14 },
  content: { paddingTop: 0, paddingHorizontal: 14, paddingBottom: 10 },
  headerIcon: { alignSelf: "center", marginBottom: 10 },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 30,
    color: DARK,
    textAlign: "center",
    textShadowColor: "#91B5CA",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 2,
  },
  subtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: "#475569",
    textAlign: "center",
    marginBottom: 12,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.45)",
    borderWidth: 1,
    borderColor: "rgba(100,130,160,0.40)",
    borderRadius: 22,
    padding: 10,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 7,
  },
  cardTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 16, color: DARK },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 5,
  },
  settingInfo: { flex: 1 },
  settingTitle: { fontFamily: "Poppins_500Medium", fontSize: 12, color: DARK },
  settingDescription: {
    fontFamily: "Poppins_400Regular",
    fontSize: 10,
    color: "#475569",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(100,130,160,0.25)",
    marginVertical: 3,
  },
  storageValue: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: BLUE,
  },
  aboutContainer: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 75, height: 75 },
  appName: { fontFamily: "Poppins_600SemiBold", fontSize: 16, color: DARK },
  developerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.35)",
    borderWidth: 1,
    borderColor: "rgba(100,130,160,0.40)",
    borderRadius: 22,
    padding: 13,
    marginBottom: 5,
    gap: 12,
  },
  developerInfo: { flex: 1, alignItems: "flex-start" },
  developerLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: "#475569",
  },
  developerName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: DARK,
    marginTop: 5,
  },
  signature: { width: 125, height: 48, marginTop: 5, tintColor: "#000000" },
  photo: {
    width: 95,
    height: 125,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#91B5CA",
  },
});
