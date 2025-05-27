// Firebase DBラッパー
// すべてのコメントを日本語に翻訳
class FirebaseDB {
    // データ構造を最適化してクエリしやすくする
    optimizeDataStructure(data) {
        if (!Array.isArray(data)) return data;
        
        return data.map(item => ({
            id: item.id || this.generateUniqueId(),
            word: item.word,
            reading: item.reading,
            meaning: item.meaning,
            srs: {
                easeFactor: item.srs?.easeFactor || 2.5,
                interval: item.srs?.interval || 1,
                repetitions: item.srs?.repetitions || 0,
                lastReviewed: item.srs?.lastReviewed || null,
                dueDate: item.srs?.dueDate || null,
                nextReview: this.calculateNextReview(item.srs)
            },
            metadata: {
                created: item.metadata?.created || Date.now(),
                modified: Date.now(),
                tags: item.metadata?.tags || [],
                difficulty: item.metadata?.difficulty || 'medium'
            }
        }));
    }
    // アイテムのユニークIDを生成
    generateUniqueId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    // SRSアルゴリズムに基づいて次回レビュー日を計算
    calculateNextReview(srs) {
        if (!srs) return null;
        if (!srs.lastReviewed) return Date.now();
        
        const interval = srs.interval * 24 * 60 * 60 * 1000; // 日数をミリ秒に変換
        return srs.lastReviewed + interval;
    }
}

window.firebaseDB = new FirebaseDB();