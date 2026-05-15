import { Component } from "react";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "@/constants/theme";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;

    if (!error) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Something went wrong</Text>
          <Text style={styles.title}>The app hit an unexpected error.</Text>
          <Text style={styles.body}>
            Your data is safe. Tap below to try recovering, or restart the app
            if the problem keeps happening.
          </Text>
          {__DEV__ ? (
            <Text style={styles.devError}>{error.message}</Text>
          ) : null}
          <Pressable onPress={this.reset} style={styles.button}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: theme.colors.background,
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: theme.colors.surfaceGlass,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: 16,
    maxWidth: 480,
    padding: 24,
    width: "100%",
  },
  eyebrow: {
    color: theme.colors.warning,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
  },
  body: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  devError: {
    backgroundColor: theme.colors.backgroundElevated,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.highlight,
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 18,
    padding: 12,
  },
  button: {
    alignItems: "center",
    backgroundColor: theme.colors.brand,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  buttonText: {
    color: theme.colors.textOnBrand,
    fontSize: 15,
    fontWeight: "800",
  },
});
