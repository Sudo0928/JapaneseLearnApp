import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { fetchTodayCards } from '../services/api';
import styles from '../styles';
const PROMPT_LABEL = {
    SURFACE_TO_MEANING: '표기→뜻',
    MEANING_TO_SURFACE: '뜻→표기',
    SURFACE_TO_READING: '표기→읽기',
    MCQ: '선택형',
    CLOZE: '문맥',
    LISTENING: '듣기',
};
export default function TodayPage() {
    const [reviewCards, setReviewCards] = useState([]);
    const [newCards, setNewCards] = useState([]);
    const [drills, setDrills] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    useEffect(() => {
        fetchTodayCards()
            .then((data) => {
            setReviewCards(data.reviewCards);
            setNewCards(data.newCards);
            setDrills(data.confusionDrills ?? []);
            setTotal(data.totalCount);
        })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);
    if (loading)
        return _jsx("div", { style: styles.center, children: "\uBD88\uB7EC\uC624\uB294 \uC911..." });
    if (error)
        return _jsx("div", { style: styles.errorBox, children: error });
    const allCards = [...reviewCards, ...newCards];
    return (_jsxs("div", { style: styles.page, children: [_jsxs("h2", { style: styles.heading, children: ["\uC624\uB298 \uD560 \uC77C ", _jsxs("span", { style: styles.badge, children: [total, "\uAC74"] })] }), allCards.length === 0 ? (_jsxs("div", { style: styles.emptyBox, children: [_jsx("span", { style: { fontSize: 40 }, children: "\uD83C\uDF89" }), _jsx("p", { children: "\uC624\uB298 \uBCF5\uC2B5\uC774 \uBAA8\uB450 \uC644\uB8CC\uB410\uC2B5\uB2C8\uB2E4!" })] })) : (_jsx("div", { style: styles.cardGrid, children: allCards.map((c) => (_jsxs("div", { style: styles.card, children: [_jsx("div", { style: styles.cardSurface, children: c.surface }), _jsx("div", { style: styles.cardReading, children: c.reading }), _jsx("div", { style: styles.cardMeaning, children: c.meaning_ko }), _jsx("div", { style: styles.cardTag, children: PROMPT_LABEL[c.prompt_type] ?? c.prompt_type }), _jsx("div", { style: { fontSize: 11, color: '#888' }, children: c.state === 'new' ? '신규' : '복습' })] }, c.card_id))) })), drills.length > 0 && (_jsxs(_Fragment, { children: [_jsxs("h3", { style: { ...styles.heading, fontSize: 16, marginTop: 24 }, children: ["\uD63C\uB3D9\uC30D \uB4DC\uB9B4 ", _jsxs("span", { style: styles.badge, children: [drills.length, "\uAC74"] })] }), _jsx("div", { style: styles.cardGrid, children: drills.map((c) => (_jsxs("div", { style: { ...styles.card, borderLeft: '3px solid #F59E0B' }, children: [_jsx("div", { style: styles.cardSurface, children: c.surface }), _jsx("div", { style: styles.cardReading, children: c.reading }), _jsx("div", { style: styles.cardMeaning, children: c.meaning_ko }), _jsx("div", { style: { ...styles.cardTag, color: '#F59E0B' }, children: "\uB4DC\uB9B4" })] }, `drill-${c.card_id}`))) })] }))] }));
}
