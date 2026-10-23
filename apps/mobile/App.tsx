import { foundation, type Locale, localeNames, locales, messages } from "@kandamkulathi/i18n";
import Constants from "expo-constants";
import { useFonts } from "expo-font";
import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import {
  AppState,
  Button,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LocalDeviceCheck } from "./src/LocalDeviceCheck";
import { receivedLink } from "./src/native";
import { NativeSensitiveFlows } from "./src/SensitiveFlows";

export default function App() {
  const [locale, setLocale] = useState<Locale>("en");
  const [draft, setDraft] = useState("");
  const [linkPending, setLinkPending] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Malayalam: require("../../packages/i18n/fonts/NotoSansMalayalam.ttf"),
    Tamil: require("../../packages/i18n/fonts/NotoSansTamil.ttf"),
  });
  useEffect(() => {
    let active = true;
    const environment: string = Constants.expoConfig?.extra?.environment ?? "local";
    const onLink = (url: string) => {
      const target = receivedLink(url, environment);
      if (active) setLinkPending(target.status === "session-required");
    };
    void Linking.getInitialURL()
      .then((url) => {
        if (url) onLink(url);
      })
      .catch(() => {});
    const links = Linking.addEventListener("url", (event) => onLink(event.url));
    const lifecycle = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        setDraft("");
        setLinkPending(false);
      }
    });
    return () => {
      active = false;
      links.remove();
      lifecycle.remove();
    };
  }, []);
  const text = foundation[locale];
  const fontFamily = fontsLoaded
    ? locale === "ml"
      ? "Malayalam"
      : locale === "ta"
        ? "Tamil"
        : undefined
    : undefined;
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.brand, { fontFamily }]}>{messages[locale].title}</Text>
        <Text style={[styles.copy, { fontFamily }]}>{messages[locale].notice}</Text>
        <View accessibilityLabel={text.language}>
          {locales.map((value) => (
            <View style={styles.button} key={value}>
              <Button
                title={localeNames[value]}
                accessibilityLabel={localeNames[value]}
                onPress={() => setLocale(value)}
              />
            </View>
          ))}
        </View>
        {fontError && <Text accessibilityRole="alert">{text.checkFailed}</Text>}
        {linkPending && <Text accessibilityLiveRegion="polite">{text.anonymous}</Text>}
        <NativeSensitiveFlows locale={locale} fontFamily={fontFamily} />
        <LocalDeviceCheck locale={locale} />
        <Text style={[styles.heading, { fontFamily }]} accessibilityRole="header">
          {text.companion}
        </Text>
        <Text style={[styles.copy, { fontFamily }]}>{text.citationPending}</Text>
        <Text accessibilityRole="text">{text.draft}</Text>
        <TextInput
          style={[styles.input, { fontFamily }]}
          accessibilityLabel={text.draft}
          multiline
          value={draft}
          onChangeText={setDraft}
          maxLength={4000}
          autoCorrect={false}
          autoComplete="off"
        />
        <Text style={[styles.copy, { fontFamily }]}>{text.draftHelp}</Text>
        <Button disabled title={text.sendPending} />
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f4ec" },
  content: { padding: 28, paddingTop: 72, paddingBottom: 48, gap: 12 },
  brand: { fontSize: 32, fontWeight: "700", color: "#163d36" },
  heading: { fontSize: 23, fontWeight: "600", color: "#163d36", marginTop: 24 },
  copy: { fontSize: 16, lineHeight: 28, color: "#415d55", marginVertical: 12 },
  button: { marginVertical: 6, minHeight: 44 },
  input: {
    backgroundColor: "white",
    minHeight: 120,
    borderWidth: 1,
    borderColor: "#647c70",
    padding: 12,
    textAlignVertical: "top",
  },
});
