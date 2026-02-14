import React, { Component, ErrorInfo, ReactNode } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Updates from "expo-updates";
import { Colors } from "@/constants/colors";
import { Typography } from "@/constants/typography";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can also log the error to an error reporting service here
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleRestart = async () => {
    try {
      await Updates.reloadAsync();
    } catch {
      // If reload fails (e.g. in dev mode sometimes), we can just clear state
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <MaterialIcons name="error-outline" size={80} color={Colors.danger} />
            
            <Text style={styles.title}>Oops! Something went wrong.</Text>
            
            <Text style={styles.subtitle}>
              We&apos;re sorry, but the application has encountered an unexpected error.
            </Text>

            <View style={styles.errorBox}>
              <ScrollView>
                <Text style={styles.errorText}>
                  {this.state.error && this.state.error.toString()}
                </Text>
              </ScrollView>
            </View>

            <TouchableOpacity
              style={styles.restartButton}
              onPress={this.handleRestart}
              activeOpacity={0.8}
            >
              <MaterialIcons name="refresh" size={24} color={Colors.white} />
              <Text style={styles.restartButtonText}>Restart App</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.default,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  content: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    backgroundColor: Colors.white,
    padding: 24,
    borderRadius: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  title: {
    fontSize: Typography.size.xxl,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    marginTop: 20,
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: Typography.size.md,
    color: Colors.text.secondary,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: Typography.lineHeight.md,
  },
  errorBox: {
    width: "100%",
    maxHeight: 150,
    backgroundColor: Colors.background.light,
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: Colors.danger,
  },
  errorText: {
    fontSize: Typography.size.xs,
    color: Colors.text.muted,
    fontFamily: Typography.fontFamily.regular,
  },
  restartButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    width: "100%",
  },
  restartButtonText: {
    color: Colors.white,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semiBold,
    marginLeft: 8,
  },
});
