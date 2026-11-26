
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  visivel: boolean;
  titulo: string;
  mensagem: string;
  icone?: keyof typeof Ionicons.glyphMap;
  textoConfirmar?: string;
  textoCancelar?: string;
  destrutivo?: boolean;
  aoFechar: () => void;
  aoConfirmar?: () => void;
};

export default function AlertaPersonalizado({
  visivel,
  titulo,
  mensagem,
  icone = "information-circle-outline",
  textoConfirmar = "OK",
  textoCancelar = "Cancelar",
  destrutivo = false,
  aoFechar,
  aoConfirmar,
}: Props) {
  return (
    <Modal
      visible={visivel}
      transparent
      animationType="fade"
      onRequestClose={aoFechar}
    >
      <View style={styles.fundo}>
        <View style={styles.card}>
          <View style={styles.iconeContainer}>
            <Ionicons
              name={icone}
              size={38}
              color={destrutivo ? "#B91C1C" : "#075985"}
            />
          </View>

          <Text style={styles.titulo}>{titulo}</Text>

          <Text style={styles.mensagem}>{mensagem}</Text>

          <View style={styles.botoes}>
            {aoConfirmar && (
              <Pressable
                style={styles.cancelar}
                onPress={aoFechar}
              >
                <Text style={styles.textoCancelar}>
                  {textoCancelar}
                </Text>
              </Pressable>
            )}

            <Pressable
              style={[
                styles.confirmar,
                destrutivo && styles.botaoDestrutivo,
              ]}
              onPress={() => {
                aoFechar();
                aoConfirmar?.();
              }}
            >
              <Text style={styles.textoConfirmar}>
                {textoConfirmar}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fundo: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 25,
    backgroundColor: "rgba(15,30,45,0.22)",
  },

  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "rgba(245,250,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(100,130,160,0.50)",
    borderRadius: 25,
    padding: 20,
  },

  iconeContainer: {
    width: 65,
    height: 65,
    borderRadius: 33,
    backgroundColor: "rgba(255,255,255,0.45)",
    borderWidth: 1,
    borderColor: "rgba(100,130,160,0.30)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 10,
  },

  titulo: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    color: "#183B56",
    textAlign: "center",
    marginBottom: 8,
  },

  mensagem: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: "#334155",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },

  botoes: {
    flexDirection: "row",
    gap: 10,
  },

  confirmar: {
    flex: 1,
    backgroundColor: "#17658F",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  cancelar: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.40)",
    borderWidth: 1,
    borderColor: "#91B5CA",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  botaoDestrutivo: {
    backgroundColor: "#B91C1C",
  },

  textoConfirmar: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: "#FFFFFF",
  },

  textoCancelar: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: "#075985",
  },
});
