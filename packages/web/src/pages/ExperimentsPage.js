import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { fetchExperiments, fetchAaValidation } from '../services/api';
import styles from '../styles';
export default function ExperimentsPage() {
    const [assignments, setAssignments] = useState([]);
    const [aaBalance, setAaBalance] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    useEffect(() => {
        Promise.all([fetchExperiments(), fetchAaValidation()])
            .then(([exp, aa]) => {
            setAssignments(exp.assignments);
            setAaBalance(aa);
        })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);
    if (loading)
        return _jsx("div", { style: styles.center, children: "\uBD88\uB7EC\uC624\uB294 \uC911..." });
    if (error)
        return _jsx("div", { style: styles.errorBox, children: error });
    return (_jsxs("div", { style: styles.page, children: [_jsx("h2", { style: styles.heading, children: "\uC2E4\uD5D8 \uD604\uD669 (A/B)" }), aaBalance && (_jsxs("div", { style: { ...styles.insightBox, marginBottom: 24 }, children: [_jsx("h3", { style: styles.sectionTitle, children: "A/A \uADE0\uD615 \uAC80\uC99D" }), _jsxs("div", { style: styles.kpiRow, children: [_jsxs("div", { style: styles.kpiCard, children: [_jsx("div", { style: { ...styles.kpiValue, color: '#6366f1' }, children: aaBalance.control_count }), _jsx("div", { style: styles.kpiLabel, children: "Control" })] }), _jsxs("div", { style: styles.kpiCard, children: [_jsx("div", { style: { ...styles.kpiValue, color: '#059669' }, children: aaBalance.treatment_count }), _jsx("div", { style: styles.kpiLabel, children: "Treatment" })] }), _jsxs("div", { style: styles.kpiCard, children: [_jsx("div", { style: {
                                            ...styles.kpiValue,
                                            color: aaBalance.is_balanced ? '#059669' : '#ef4444',
                                        }, children: aaBalance.is_balanced ? '균형 OK' : '불균형 주의' }), _jsx("div", { style: styles.kpiLabel, children: "\uC0C1\uD0DC" })] })] })] })), _jsxs("div", { style: styles.confusionBox, children: [_jsx("h3", { style: styles.sectionTitle, children: "\uB0B4 \uC2E4\uD5D8 \uBC30\uC815" }), assignments.length === 0 ? (_jsx("p", { style: { color: '#64748b' }, children: "\uBC30\uC815\uB41C \uC2E4\uD5D8 \uC5C6\uC74C" })) : (_jsxs("table", { style: styles.table, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: styles.th, children: "\uC2E4\uD5D8 ID" }), _jsx("th", { style: styles.th, children: "\uBC30\uC815 \uBCC0\uD615" }), _jsx("th", { style: styles.th, children: "\uBC30\uC815 \uC77C\uC2DC" })] }) }), _jsx("tbody", { children: assignments.map((a, i) => (_jsxs("tr", { style: i % 2 === 0 ? styles.trEven : styles.trOdd, children: [_jsx("td", { style: styles.td, children: a.exp_id }), _jsx("td", { style: styles.td, children: _jsx("span", { style: {
                                                    ...styles.kpiLabel,
                                                    background: a.variant === 'control' ? '#e0e7ff' : '#dcfce7',
                                                    color: a.variant === 'control' ? '#4338ca' : '#166534',
                                                    borderRadius: 4,
                                                    padding: '2px 8px',
                                                }, children: a.variant }) }), _jsx("td", { style: styles.td, children: a.assigned_at ? new Date(a.assigned_at).toLocaleString('ko-KR') : '-' })] }, a.exp_id))) })] }))] })] }));
}
