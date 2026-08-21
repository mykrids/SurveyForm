import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 18, marginBottom: 8, fontWeight: 700 },
  subtitle: { fontSize: 10, color: "#666", marginBottom: 16 },
  section: { marginBottom: 16, padding: 12, backgroundColor: "#f8f8f8", borderRadius: 4 },
  h2: { fontSize: 12, fontWeight: 700, marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  cell: { flex: 1 },
  header: { backgroundColor: "#111", color: "#fff", padding: 6, flexDirection: "row" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eee", padding: 6 },
});

export function ReportDocument({ surveyTitle, rows, generatedAt }: { surveyTitle: string; rows: Record<string, string>[]; generatedAt: string }) {
  const total = rows.length;
  const headers = rows[0] ? Object.keys(rows[0]) : [];

  // simple aggregation: count for each column value
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{surveyTitle} — 응답 집계 리포트</Text>
        <Text style={styles.subtitle}>생성 시각: {generatedAt} · 총 응답 수: {total}건</Text>

        <View style={styles.section}>
          <Text style={styles.h2}>요약</Text>
          <Text>• 총 응답: {total}건</Text>
          <Text>• 컬럼 수: {headers.length}개</Text>
          <Text>• 생성 방식: GAS read → @react-pdf/renderer (puppeteer 미사용)</Text>
        </View>

        {headers.length > 0 && (
          <View>
            <View style={styles.header}>
              {headers.map(h => (
                <Text key={h} style={styles.cell}>{h}</Text>
              ))}
            </View>
            {rows.slice(0, 50).map((r, i) => (
              <View key={i} style={styles.tableRow}>
                {headers.map(h => (
                  <Text key={h} style={styles.cell}>{String(r[h] ?? "")}</Text>
                ))}
              </View>
            ))}
            {rows.length > 50 && <Text style={{ marginTop: 8, color: "#888" }}>… 외 {rows.length - 50}건 생략 (시트 전체는 Sheets에서 확인)</Text>}
          </View>
        )}

        <Text style={{ marginTop: 24, fontSize: 8, color: "#999" }}>
          본 리포트는 종료 후 지연 배치(Cron)로 생성되었습니다. 데이터 저장소: Supabase(메타) / Google Sheets(응답) · 발송: Resend
        </Text>
      </Page>
    </Document>
  );
}
