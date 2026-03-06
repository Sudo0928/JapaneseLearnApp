const styles = {
    // 레이아웃
    page: { maxWidth: 900, margin: '0 auto', padding: '24px 16px' },
    center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, color: '#64748b' },
    errorBox: { background: '#fef2f2', color: '#b91c1c', padding: '12px 16px', borderRadius: 8, margin: '24px 0' },
    emptyBox: { textAlign: 'center', padding: '48px 0', color: '#64748b' },
    // 타이포
    heading: { fontSize: 22, fontWeight: 700, margin: '0 0 4px' },
    subtext: { color: '#64748b', fontSize: 14, margin: '0 0 24px' },
    sectionTitle: { fontSize: 15, fontWeight: 600, margin: '0 0 12px', color: '#334155' },
    badge: { background: '#e0e7ff', color: '#4338ca', borderRadius: 9999, padding: '2px 10px', fontSize: 13, fontWeight: 600, marginLeft: 8 },
    // KPI 카드
    kpiRow: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 },
    kpiCard: { flex: '1 1 120px', background: '#fff', borderRadius: 10, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,.08)', textAlign: 'center' },
    kpiValue: { fontSize: 26, fontWeight: 700, color: '#6366f1' },
    kpiLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
    // 오늘 할 일 카드
    cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 },
    card: { background: '#fff', borderRadius: 10, padding: '16px 12px', boxShadow: '0 1px 4px rgba(0,0,0,.08)', display: 'flex', flexDirection: 'column', gap: 4 },
    cardSurface: { fontSize: 22, fontWeight: 700, color: '#1e293b', textAlign: 'center' },
    cardReading: { fontSize: 13, color: '#6366f1', textAlign: 'center' },
    cardMeaning: { fontSize: 13, color: '#374151', textAlign: 'center', flexGrow: 1 },
    cardTag: { fontSize: 11, background: '#f1f5f9', color: '#64748b', borderRadius: 4, padding: '2px 6px', alignSelf: 'center', marginTop: 4 },
    // 차트 / 인사이트 / 혼동쌍
    chartBox: { background: '#fff', borderRadius: 10, padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,.08)', marginBottom: 20 },
    insightBox: { background: '#f0fdf4', borderRadius: 10, padding: '16px 20px', marginBottom: 20 },
    insightList: { margin: 0, paddingLeft: 20 },
    insightItem: { marginBottom: 6, fontSize: 14, color: '#166534', lineHeight: 1.6 },
    confusionBox: { background: '#fff', borderRadius: 10, padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,.08)', marginBottom: 20 },
    // 테이블
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { textAlign: 'left', padding: '8px 12px', fontSize: 13, color: '#64748b', borderBottom: '2px solid #e2e8f0' },
    td: { padding: '8px 12px', fontSize: 14, color: '#1e293b' },
    trEven: { background: '#fff' },
    trOdd: { background: '#f8fafc' },
};
export default styles;
