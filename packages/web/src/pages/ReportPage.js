import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, } from 'recharts';
import { fetchWeeklyReport } from '../services/api';
import styles from '../styles';
function pct(v) { return `${(v * 100).toFixed(1)}%`; }
export default function ReportPage() {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    useEffect(() => {
        fetchWeeklyReport()
            .then(setReport)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);
    if (loading)
        return _jsx("div", { style: styles.center, children: "\uBD88\uB7EC\uC624\uB294 \uC911..." });
    if (error)
        return _jsx("div", { style: styles.errorBox, children: error });
    if (!report)
        return null;
    const avgCorrectRate = report.summary.avg_correct_rate;
    const delayedRecallRate = report.retention_metrics.due_7d.recall_rate;
    const overdueRate = report.daily_stats.length > 0
        ? report.summary.overdue_days / report.daily_stats.length
        : 0;
    const kpiData = [
        { name: '정답률', value: avgCorrectRate, color: '#6366f1' },
        { name: '지연 인출률', value: delayedRecallRate, color: '#059669' },
        { name: '연체율', value: overdueRate, color: '#ef4444' },
    ];
    return (_jsxs("div", { style: styles.page, children: [_jsx("h2", { style: styles.heading, children: "\uC8FC\uAC04 \uB9AC\uD3EC\uD2B8" }), _jsxs("p", { style: styles.subtext, children: [report.period.from, " ~ ", report.period.to] }), _jsxs("div", { style: styles.kpiRow, children: [_jsx(KpiCard, { label: "\uCD1D \uB9AC\uBDF0", value: `${report.summary.total_reviews}건` }), _jsx(KpiCard, { label: "\uC2A4\uD2B8\uB9AD", value: `${report.summary.streak_days}일`, color: "#f59e0b" }), _jsx(KpiCard, { label: "\uC9C0\uC5F0 \uC778\uCD9C\uB960", value: pct(delayedRecallRate), color: "#059669" }), _jsx(KpiCard, { label: "\uC5F0\uCCB4\uC728", value: pct(overdueRate), color: "#ef4444" })] }), _jsxs("div", { style: styles.kpiRow, children: [_jsx(KpiCard, { label: "14\uC77C \uC720\uC9C0", value: pct(report.retention_metrics.due_14d.recall_rate), color: "#0ea5e9" }), _jsx(KpiCard, { label: "30\uC77C \uC720\uC9C0", value: pct(report.retention_metrics.due_30d.recall_rate), color: "#8b5cf6" }), _jsx(KpiCard, { label: "\uC5F0\uCCB4 \uBCF4\uC815", value: pct(report.retention_metrics.overdue_adjusted_recall_rate), color: "#f97316" }), _jsx(KpiCard, { label: "\uD68C\uBCF5 \uC644\uB8CC\uC728", value: pct(report.recovery_metrics.recovery_completion_rate), color: "#22c55e" })] }), _jsxs("div", { style: styles.chartBox, children: [_jsx("h3", { style: styles.sectionTitle, children: "\uD575\uC2EC \uC9C0\uD45C" }), _jsx(ResponsiveContainer, { width: "100%", height: 200, children: _jsxs(BarChart, { data: kpiData, margin: { top: 8, right: 16, left: 0, bottom: 0 }, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#e2e8f0" }), _jsx(XAxis, { dataKey: "name", tick: { fontSize: 13 } }), _jsx(YAxis, { tickFormatter: (v) => pct(v), domain: [0, 1], tick: { fontSize: 12 } }), _jsx(Tooltip, { formatter: (v) => pct(v) }), _jsx(Bar, { dataKey: "value", radius: [4, 4, 0, 0], children: kpiData.map((d, i) => _jsx(Cell, { fill: d.color }, i)) })] }) })] }), report.insights.length > 0 && (_jsxs("div", { style: styles.insightBox, children: [_jsx("h3", { style: styles.sectionTitle, children: "\uC778\uC0AC\uC774\uD2B8" }), _jsx("ul", { style: styles.insightList, children: report.insights.map((ins, i) => (_jsx("li", { style: styles.insightItem, children: ins }, i))) })] })), report.confusion_metrics.top_confusions.length > 0 && (_jsxs("div", { style: styles.confusionBox, children: [_jsx("h3", { style: styles.sectionTitle, children: "\uC790\uC8FC \uD754\uB4E4\uB9AC\uB294 \uD56D\uBAA9 Top 5" }), _jsxs("table", { style: styles.table, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: styles.th, children: "\uD45C\uAE30" }), _jsx("th", { style: styles.th, children: "\uC624\uB958 \uC720\uD615" }), _jsx("th", { style: styles.th, children: "\uC624\uB958 \uD69F\uC218" })] }) }), _jsx("tbody", { children: report.confusion_metrics.top_confusions.map((p, i) => (_jsxs("tr", { style: i % 2 === 0 ? styles.trEven : styles.trOdd, children: [_jsx("td", { style: styles.td, children: p.surface }), _jsx("td", { style: styles.td, children: p.error_type }), _jsx("td", { style: { ...styles.td, textAlign: 'center' }, children: p.error_count })] }, i))) })] })] })), _jsxs("div", { style: styles.insightBox, children: [_jsx("h3", { style: styles.sectionTitle, children: "\uD68C\uBCF5 \uC9C0\uD45C" }), _jsxs("ul", { style: styles.insightList, children: [_jsxs("li", { style: styles.insightItem, children: ["\uD3C9\uADE0 \uC5F0\uCCB4 \uBC31\uB85C\uADF8: ", report.recovery_metrics.overdue_backlog_days.toFixed(1), "\uC77C"] }), _jsxs("li", { style: styles.insightItem, children: ["\uC815\uC0C1\uD654\uAE4C\uC9C0 \uC18C\uC694: ", report.recovery_metrics.recovery_time_to_normal_days ?? '-', "\uC77C"] }), _jsxs("li", { style: styles.insightItem, children: ["\uD68C\uBCF5 \uD6C4 \uC720\uC9C0\uC728: ", report.recovery_metrics.post_recovery_retention !== null
                                        ? pct(report.recovery_metrics.post_recovery_retention)
                                        : '데이터 부족'] })] })] })] }));
}
function KpiCard({ label, value, color = '#6366f1' }) {
    return (_jsxs("div", { style: styles.kpiCard, children: [_jsx("div", { style: { ...styles.kpiValue, color }, children: value }), _jsx("div", { style: styles.kpiLabel, children: label })] }));
}
