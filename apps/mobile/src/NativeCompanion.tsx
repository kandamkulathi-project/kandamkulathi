import { currentAnswer } from "@kandamkulathi/client/knowledge";
import type { SensitiveClient } from "@kandamkulathi/client/sensitive";
import {
  type ApprovedEntry,
  type KnowledgeReply,
  publicSourceUrl,
} from "@kandamkulathi/contracts/knowledge";
import { foundation, type Locale } from "@kandamkulathi/i18n";
import { knowledgeText } from "@kandamkulathi/i18n/knowledge";
import * as Crypto from "expo-crypto";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { AppState, Button, Linking, Text, TextInput, View } from "react-native";

export function NativeCompanion({
  client,
  locale,
  fontFamily,
}: {
  client: SensitiveClient | undefined;
  locale: Locale;
  fontFamily: string | undefined;
}) {
  const text = knowledgeText[locale];
  const basic = foundation[locale];
  const [draft, setDraft] = useState("");
  const [entries, setEntries] = useState<ApprovedEntry[]>([]);
  const [reply, setReply] = useState<KnowledgeReply>();
  const [state, setState] = useState("pending");
  const busy = useRef(false);
  const epoch = useRef(0);
  const operation = useRef<{ text: string; id: string } | undefined>(undefined);
  const handoff = useRef<string | undefined>(undefined);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", () => {
      epoch.current++;
      setDraft("");
      setEntries([]);
      setReply(undefined);
    });
    return () => {
      epoch.current++;
      subscription.remove();
    };
  }, []);
  async function display(value: KnowledgeReply, attempt: number) {
    if (!client || attempt !== epoch.current || AppState.currentState !== "active") return;
    setEntries([]);
    setReply(value);
    if (value.locale !== locale) {
      setState("unavailable");
      return;
    }
    if (value.kind !== "answer") {
      setState(value.kind);
      return;
    }
    const result = await currentAnswer(client, value);
    if (attempt !== epoch.current || AppState.currentState !== "active") return;
    if (result.status === "ready") {
      setEntries(result.data);
      setState("ready");
    } else setState("unavailable");
  }
  const refresh = useEffectEvent(() => {
    if (!reply || busy.current) return;
    busy.current = true;
    const attempt = ++epoch.current;
    setState("loading");
    void display(reply, attempt).finally(() => {
      busy.current = false;
    });
  });
  useEffect(() => {
    if (!entries.length) return;
    const expiry = setTimeout(
      () => {
        setEntries([]);
        setState("unavailable");
      },
      Math.min(
        2147483647,
        Math.max(
          0,
          Math.min(...entries.map((entry) => Date.parse(entry.reviewUntil))) - Date.now(),
        ),
      ),
    );
    const timer = setInterval(refresh, 30000);
    return () => {
      clearTimeout(expiry);
      clearInterval(timer);
    };
  }, [entries]);
  return (
    <View style={{ gap: 16 }}>
      <Text accessibilityRole="header" style={{ fontFamily }}>
        {basic.companion}
      </Text>
      <Text accessibilityLiveRegion="polite" style={{ fontFamily }}>
        {!client
          ? basic.citationPending
          : state === "queued"
            ? text.queued
            : state === "ready"
              ? text.citations
              : state === "action_required"
                ? text.actions
                : state === "intake_required"
                  ? text.intake
                  : state === "loading"
                    ? basic.loading
                    : text.fallback}
      </Text>
      <Text style={{ fontFamily }}>{basic.draft}</Text>
      <TextInput
        accessibilityLabel={basic.draft}
        multiline
        autoComplete="off"
        autoCorrect={false}
        maxLength={4000}
        editable={state !== "loading"}
        style={{ fontFamily, minHeight: 120, borderWidth: 1, padding: 12 }}
        value={draft}
        onChangeText={(value) => {
          epoch.current++;
          setDraft(value);
          setEntries([]);
          setReply(undefined);
          setState("pending");
        }}
      />
      <Text style={{ fontFamily }}>{text.voice}</Text>
      <Button
        title={client ? text.send : basic.sendPending}
        disabled={!client || !draft.trim() || state === "loading"}
        onPress={async () => {
          if (!client || busy.current) return;
          busy.current = true;
          const attempt = ++epoch.current;
          setState("loading");
          setEntries([]);
          if (!operation.current || operation.current.text !== draft)
            operation.current = { text: draft, id: Crypto.randomUUID() };
          try {
            const result = await client.chat({
              operationId: operation.current.id,
              message: draft,
              locale,
            });
            if (attempt !== epoch.current) return;
            if (result.status === "ready") await display(result.data, attempt);
            else {
              setReply(undefined);
              setState(result.status);
            }
          } finally {
            busy.current = false;
          }
        }}
      />
      {client && (
        <Button
          title={text.handoff}
          disabled={state === "loading"}
          onPress={async () => {
            if (busy.current) return;
            busy.current = true;
            const attempt = ++epoch.current;
            setState("loading");
            setEntries([]);
            setReply(undefined);
            handoff.current ??= Crypto.randomUUID();
            try {
              const result = await client.requestHandoff(handoff.current, locale);
              if (attempt === epoch.current)
                setState(result.status === "ready" ? "queued" : result.status);
            } finally {
              busy.current = false;
            }
          }}
        />
      )}
      {client &&
        entries.map((entry) => (
          <View key={entry.id} style={{ gap: 12 }}>
            <Text accessibilityRole="header" style={{ fontFamily }}>
              {entry.document.title}
            </Text>
            <Text style={{ fontFamily }}>{entry.document.body}</Text>
            <Text style={{ fontFamily }}>
              {text.approver}: {entry.approvedBy?.displayName}
            </Text>
            {Object.entries(entry.document.safety).map(
              ([key, value]) =>
                value && (
                  <Text key={key} style={{ fontFamily }}>
                    {value}
                  </Text>
                ),
            )}
            <Button
              title={`${text.citations}: ${new URL(entry.document.sourceUrl).hostname} · v${entry.revision}`}
              onPress={() => {
                const url = publicSourceUrl(entry.document.sourceUrl);
                if (url) void Linking.openURL(url).catch(() => setState("unavailable"));
              }}
            />
          </View>
        ))}
    </View>
  );
}
