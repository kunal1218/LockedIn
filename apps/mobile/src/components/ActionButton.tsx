import { Pressable, Text } from "react-native";
import { styles } from "../styles/ui";

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "default" | "danger" | "muted";
};

export const ActionButton = ({
  label,
  onPress,
  disabled,
  tone = "default",
}: ActionButtonProps) => {
  const buttonStyles = [
    styles.button,
    tone === "danger"
      ? styles.buttonDanger
      : tone === "muted"
      ? styles.buttonMuted
      : null,
    disabled ? styles.buttonDisabled : null,
  ];

  const labelStyles = [
    styles.buttonLabel,
    tone === "danger"
      ? styles.buttonLabelDanger
      : tone === "muted"
      ? styles.buttonLabelMuted
      : null,
  ];

  return (
    <Pressable disabled={disabled} onPress={onPress} style={buttonStyles}>
      <Text style={labelStyles}>{label}</Text>
    </Pressable>
  );
};
