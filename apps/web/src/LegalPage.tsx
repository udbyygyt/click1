import { useEffect } from 'react';
import type { Language } from './i18n';

interface LegalCopy { title: string; back: string; paragraphs: string[] }

const copy: Record<Language, Record<'privacy' | 'terms' | 'support', LegalCopy>> = {
  en: {
    privacy: { title: 'Privacy Policy', back: 'Back to Click+1', paragraphs: ['Click+1 does not collect product analytics, advertising identifiers, or gameplay behavior profiles.', 'To provide the game, we process your wallet public address, authentication session, current game state, move snapshots, and payment verification records. We never request or store private keys or seed phrases.', 'You can delete your account and associated application data from the app. Blockchain transactions cannot be deleted or reversed.'] },
    terms: { title: 'Terms of Use', back: 'Back to Click+1', paragraphs: ['Click+1 is a skill-based puzzle game. It does not provide investment advice, yield, token rewards, or player-to-player wagering.', 'A paid undo costs 0.01 SOL plus network fees. Confirmed blockchain payments are normally irreversible and non-refundable, subject to rights required by applicable law and handling of duplicate charges or service failures.', 'Solana network transactions require a compatible wallet and are your responsibility to review before signing.'] },
    support: { title: 'Support', back: 'Back to Click+1', paragraphs: ['For wallet, payment, or account deletion issues, keep the transaction signature and the approximate UTC time of the event.', 'The production support email and response policy must be configured before publishing this app.'] },
  },
  'zh-CN': {
    privacy: { title: '隐私政策', back: '返回 Click+1', paragraphs: ['Click+1 不收集产品分析、广告标识或游戏行为画像。', '为提供游戏服务，我们会处理钱包公钥、登录会话、当前游戏状态、操作快照和支付验证记录。我们不会索要或保存私钥、助记词。', '你可以在应用中删除账户及关联的应用数据。链上交易无法删除或逆转。'] },
    terms: { title: '使用条款', back: '返回 Click+1', paragraphs: ['Click+1 是一款技巧型益智游戏，不提供投资建议、收益、代币奖励或玩家间下注。', '付费撤回费用为 0.01 SOL，另加网络费。已确认的链上支付通常不可逆且不退款，但不排除适用法律要求以及重复扣款或服务故障处理。', 'Solana 网络交易需要兼容钱包，签名前请自行核对交易内容。'] },
    support: { title: '支持', back: '返回 Click+1', paragraphs: ['如果遇到钱包、支付或账户删除问题，请保留交易签名和事件发生的大致 UTC 时间。', '正式发布前需要配置生产客服邮箱和响应政策。'] },
  },
  ja: {
    privacy: { title: 'プライバシーポリシー', back: 'Click+1 に戻る', paragraphs: ['Click+1 は製品分析、広告識別子、ゲーム行動プロファイルを収集しません。', 'ゲーム提供のため、ウォレット公開アドレス、認証セッション、現在のゲーム状態、操作スナップショット、支払い確認記録を処理します。秘密鍵やシードフレーズを求めたり保存したりしません。', 'アプリからアカウントと関連データを削除できます。ブロックチェーン取引は削除・逆転できません。'] },
    terms: { title: '利用規約', back: 'Click+1 に戻る', paragraphs: ['Click+1 はスキルベースのパズルゲームです。投資助言、利回り、トークン報酬、プレイヤー間の賭けは提供しません。', '有料の取り消しは 0.01 SOL とネットワーク手数料です。確認済みのブロックチェーン決済は通常取り消し・返金できませんが、適用法上の権利や重複請求・障害対応を除きます。', 'Solana の取引には対応ウォレットが必要です。署名前に内容を確認してください。'] },
    support: { title: 'サポート', back: 'Click+1 に戻る', paragraphs: ['ウォレット、支払い、アカウント削除の問題では、取引署名と発生時刻のおおよその UTC 時刻を保管してください。', '公開前に本番サポートメールと対応方針を設定する必要があります。'] },
  },
};

function detectLanguage(): Language {
  const value = localStorage.getItem('click1-language');
  return value === 'zh-CN' || value === 'ja' ? value : 'en';
}

export function LegalPage({ kind }: { kind: 'privacy' | 'terms' | 'support' }) {
  const language = detectLanguage();
  const page = copy[language][kind];
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  return <main className="shell legal-page"><a href="/">← {page.back}</a><h1>{page.title}</h1>{page.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</main>;
}
