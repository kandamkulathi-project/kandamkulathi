import { type Locale, localeNames, locales, messages } from "@kandamkulathi/i18n";
import { useState } from "react";
import { Button, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
export default function App() {
  const [locale, setLocale] = useState<Locale>("en");
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>{messages[locale].title}</Text>
        <Text style={styles.heading}>{messages[locale].welcome}</Text>
        <Text style={styles.copy}>{messages[locale].notice}</Text>
        <View accessibilityLabel="Choose language">
          {locales.map((value) => (
            <View style={styles.button} key={value}>
              <Button
                title={localeNames[value]}
                onPress={() => setLocale(value)}
                accessibilityLabel={localeNames[value]}
              />
            </View>
          ))}
        </View>
        <Text style={styles.copy}>
          Native sign-in, payments, consultations and Companion are pending implementation. No
          private data or live actions are available.
        </Text>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f4ec" },
  content: { padding: 28, paddingTop: 72, paddingBottom: 48 },
  brand: { fontSize: 32, fontWeight: "700", color: "#163d36", marginBottom: 32 },
  heading: { fontSize: 23, fontWeight: "600", color: "#163d36" },
  copy: { fontSize: 16, lineHeight: 26, color: "#415d55", marginVertical: 20 },
  button: { marginVertical: 6, minHeight: 44 },
});
