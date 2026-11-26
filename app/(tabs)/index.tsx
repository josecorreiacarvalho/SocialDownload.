import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as Network from "expo-network";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AlertaPersonalizado from "../../components/AlertaPersonalizado";
import { useShareIntentContext } from "expo-share-intent";

const BLUE = "#075985";
const DARK = "#183B56";
const REDES = [
  { nome: "TikTok", dominios: ["tiktok.com"] },
  { nome: "Instagram", dominios: ["instagram.com"] },
  { nome: "Facebook", dominios: ["facebook.com", "fb.watch", "fb.com"] },
  {
    nome: "Pinterest",
    dominios: ["pinterest.com", "pinterest.com.br", "pin.it"],
  },
  { nome: "X (Twitter)", dominios: ["x.com", "twitter.com"] },
];

function identificarRede(endereco: string) {
  try {
    const url = new URL(endereco.trim());

    if (url.protocol !== "https:") return null;

    return (
      REDES.find((rede) =>
        rede.dominios.some(
          (dominio) =>
            url.hostname === dominio || url.hostname.endsWith("." + dominio),
        ),
      ) ?? null
    );
  } catch {
    return null;
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const [link, setLink] = useState("");
  const redeIdentificada = identificarRede(link);
  const { hasShareIntent, shareIntent, resetShareIntent } =
    useShareIntentContext();

  useEffect(() => {
    if (!hasShareIntent) return;

    const texto = shareIntent.webUrl || shareIntent.text || "";
    const endereco = texto.match(/https?:\/\/[^\s]+/i)?.[0];

    if (endereco) {
      setLink(endereco);
    }

    resetShareIntent();
  }, [hasShareIntent, shareIntent, resetShareIntent]);
  const [alerta, setAlerta] = useState({
    visivel: false,
    titulo: "",
    mensagem: "",
  });

  function mostrarAlerta(titulo: string, mensagem: string) {
    setAlerta({ visivel: true, titulo, mensagem });
  }

  function fecharAlerta() {
    setAlerta((anterior) => ({ ...anterior, visivel: false }));
  }

  async function colarLink() {
    const texto = await Clipboard.getStringAsync();
    setLink(texto.trim());
  }

  async function baixarVideo() {
    const endereco = link.trim();

    if (!endereco) {
      mostrarAlerta("Atenção", "Cole o link no SocialDownload.");
      return;
    }

    const plataforma = identificarRede(endereco);

    if (!plataforma) {
      mostrarAlerta(
        "Link inválido",
        "Insira um link do TikTok, Instagram, Facebook, Pinterest ou X.",
      );
      return;
    }

    try {
      const somenteWifi = await AsyncStorage.getItem(
        "@TikDownload:somenteWifi",
      );

      const rede = await Network.getNetworkStateAsync();

      if (!rede.isConnected || rede.isInternetReachable === false) {
        mostrarAlerta("Sem conexão", "Verifique sua conexão com a internet.");
        return;
      }

      if (
        somenteWifi === "true" &&
        rede.type !== Network.NetworkStateType.WIFI
      ) {
        mostrarAlerta(
          "Somente Wi-Fi",
          "Conecte-se a uma rede Wi-Fi ou desative essa opção nos Ajustes.",
        );
        return;
      }

      router.push({
        pathname: "/navegador",
        params: { link: endereco },
      });
    } catch {
      mostrarAlerta(
        "Erro de conexão",
        "Não foi possível verificar a conexão com a internet.",
      );
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Image
        source={require("../../assets/images/social-logo.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>
        Social<Text style={{ color: "#007BFF" }}>Download</Text>
      </Text>
      <Text style={styles.subtitle}>Seus vídeos favoritos em um só lugar</Text>
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="cloud-download-outline" size={25} color={BLUE} />
          <Text style={styles.cardTitle}>Baixar vídeo</Text>
        </View>
        <Text style={styles.description}>
          {redeIdentificada
            ? `Rede identificada: ${redeIdentificada.nome}`
            : "TikTok, Instagram, Facebook, Pinterest e X"}
        </Text>
        <View style={styles.inputContainer}>
          <Ionicons name="link-outline" size={21} color={BLUE} />
          <TextInput
            style={styles.input}
            value={link}
            onChangeText={setLink}
            placeholder="Cole o link aqui..."
            placeholderTextColor="#64748B"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>
        <View style={styles.buttonsRow}>
          <Pressable style={styles.smallButton} onPress={colarLink}>
            <Ionicons name="clipboard-outline" size={18} color={BLUE} />
            <Text style={styles.smallButtonText}>Colar link</Text>
          </Pressable>
          <Pressable style={styles.smallButton} onPress={() => setLink("")}>
            <Ionicons name="trash-outline" size={18} color={BLUE} />
            <Text style={styles.smallButtonText}>Limpar</Text>
          </Pressable>
        </View>
        <Pressable style={styles.downloadButton} onPress={baixarVideo}>
          <Ionicons name="download-outline" size={23} color="#FFFFFF" />
          <Text style={styles.downloadText}>BAIXAR VÍDEO</Text>
        </Pressable>
      </View>
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="help-circle-outline" size={24} color={BLUE} />
          <Text style={styles.cardTitle}>Como baixar?</Text>
        </View>
        {[
          "Copie o link do vídeo na rede social.",
          "Cole o link no SocialDownload.",
          "Toque em Baixar vídeo.",
        ].map((texto, index) => (
          <View key={index} style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            <Text style={styles.stepText}>{texto}</Text>
          </View>
        ))}
      </View>
      <AlertaPersonalizado
        visivel={alerta.visivel}
        titulo={alerta.titulo}
        mensagem={alerta.mensagem}
        icone={
          alerta.titulo === "Somente Wi-Fi"
            ? "wifi-outline"
            : alerta.titulo === "Sem conexão"
              ? "cloud-offline-outline"
              : "alert-circle-outline"
        }
        aoFechar={fecharAlerta}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingTop: 45, paddingHorizontal: 14, paddingBottom: 85 },
  logo: { width: 125, height: 125, alignSelf: "center" },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 32,
    color: DARK,
    textAlign: "center",
    marginTop: 5,
    textShadowColor: "#91B5CA",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 2,
  },
  subtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 22,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.45)",
    borderWidth: 1,
    borderColor: "rgba(100,130,160,0.40)",
    borderRadius: 24,
    padding: 15,
    marginBottom: 12,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 16, color: DARK },
  description: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: "#1E293B",
    marginTop: 5,
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.65)",
    borderWidth: 1,
    borderColor: "#B4CBD9",
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
    height: 48,
  },
  input: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: DARK,
    paddingVertical: 0,
  },
  buttonsRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  smallButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.40)",
    borderWidth: 1,
    borderColor: "#B4CBD9",
    borderRadius: 11,
    paddingVertical: 10,
    gap: 6,
  },
  smallButtonText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: BLUE,
  },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#17658F",
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 12,
    gap: 8,
  },
  downloadText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  step: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  stepNumber: {
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: "#17658F",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: "#FFFFFF",
  },
  stepText: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: DARK,
  },
});
