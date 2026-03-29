/* contract-html.js — Returns the full bilingual PDF contract as an HTML string. */
function contractHTML(agentName, signDate) {
  var font = '"Times New Roman", Times, "Noto Serif TC", serif';
  var h = function(num, en, zh) {
    return '<div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;'
         + 'color:#0D9488;border-top:1.5px solid #ccc;padding-top:14px;margin-top:24px;margin-bottom:12px;">'
         + num + '. ' + en + ' / ' + zh + '</div>';
  };
  var en = function(t) { return '<p style="margin:0 0 5px;color:#111;font-size:13px;">' + t + '</p>'; };
  var zh = function(t) { return '<p style="margin:0 0 14px;color:#555;font-style:italic;font-size:12px;">' + t + '</p>'; };
  var zhl = function(t) { return '<p style="margin:0 0 6px;color:#555;font-style:italic;font-size:12px;">' + t + '</p>'; };

  return '<div style="font-family:' + font + ';padding:48px 52px;max-width:760px;margin:0 auto;background:#fff;color:#111;font-size:13px;line-height:1.85;">'

  + '<div style="text-align:center;padding-bottom:24px;margin-bottom:30px;border-bottom:3px solid #0D9488;">'
  +   '<div style="font-size:34px;font-weight:700;color:#0D9488;letter-spacing:0.04em;margin-bottom:6px;">Web人</div>'
  +   '<div style="font-size:16px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#111;margin-bottom:5px;">Agent Referral Agreement</div>'
  +   '<div style="font-size:13px;color:#666;font-style:italic;">代理人推薦協議</div>'
  + '</div>'

  + '<table style="width:100%;border-collapse:collapse;margin-bottom:30px;font-size:13px;border:1px solid #ccc;">'
  +   '<tr style="background:#f7fafa;">'
  +     '<td style="padding:10px 16px;color:#555;font-weight:700;width:42%;border-bottom:1px solid #ccc;border-right:1px solid #ccc;">Agent Name / 代理人姓名</td>'
  +     '<td style="padding:10px 16px;color:#0D9488;font-weight:700;border-bottom:1px solid #ccc;">' + agentName + '</td>'
  +   '</tr>'
  +   '<tr style="background:#fff;">'
  +     '<td style="padding:10px 16px;color:#555;font-weight:700;border-bottom:1px solid #ccc;border-right:1px solid #ccc;">Date of Acceptance / 簽署日期</td>'
  +     '<td style="padding:10px 16px;color:#0D9488;font-weight:700;border-bottom:1px solid #ccc;">' + signDate + '</td>'
  +   '</tr>'
  +   '<tr style="background:#f7fafa;">'
  +     '<td style="padding:10px 16px;color:#555;font-weight:700;border-right:1px solid #ccc;">Parties / 雙方</td>'
  +     '<td style="padding:10px 16px;color:#111;">Aaron (Web人) &amp; ' + agentName + '</td>'
  +   '</tr>'
  + '</table>'

  + h('1', 'Commission &amp; Refunds', '佣金與退款')
  + en('<strong>Rate:</strong> You will receive 15% of the net monthly subscription fee (excluding VAT and third-party payment fees) for each active client you refer.')
  + zh('推薦每一位有效客戶，您將獲得實際收訖淨額之 15%（不含營業稅及第三方支付手續費）作為佣金。')
  + en('<strong>Clawback:</strong> If a client receives a refund or files a chargeback, any commission paid for that transaction will be deducted from your future earnings.')
  + zh('若客戶獲得退款或發生信用卡退款爭議，該交易所支付之佣金將從您後續佣金中扣除。')
  + en('<strong>Minimum Payout:</strong> Commissions are disbursed once your earned balance reaches NT$1,000 TWD.')
  + zh('佣金累計達 1,000 TWD 後方予發放。')
  + en('<strong>Timeline:</strong> Payment is made within 7 days after the client\'s subscription is successfully renewed and funds are cleared.')
  + zhl('於客戶成功續約且款項入帳後 7 日內支付。')

  + h('2', 'Independent Contractor Status', '獨立承攬人地位')
  + en('<strong>No Employment:</strong> This is a Contract for Hire. You are NOT an employee, partner, or joint venture of the Company. You are responsible for your own taxes, Labor Insurance, and Health Insurance.')
  + zh('本協議屬承攬關係。您非本公司之員工、合夥人或合資對象，須自行負擔相關稅務、勞保及健保。')
  + en('<strong>No Authority:</strong> You have no authority to sign contracts, make legal promises, or offer custom discounts on behalf of Aaron (Web人).')
  + zhl('您無權代表 Aaron (Web人) 簽署契約、做出法律承諾或提供客製化折扣。')

  + h('3', 'Conduct &amp; Brand Protection', '行為準則與品牌保護')
  + en('<strong>Brand Usage:</strong> You may use the "Web人" name and logo for marketing purposes only in accordance with our guidelines.')
  + zh('您得依本公司規範於行銷活動中使用「Web人」品牌名稱與標誌。')
  + en('<strong>No Spam:</strong> No unsolicited messaging or deceptive marketing. Breach results in immediate termination and forfeiture of unpaid commissions.')
  + zh('嚴禁發送垃圾郵件或進行欺騙性行銷。違者立即終止協議，未領佣金予以沒收。')
  + en('<strong>Non-Solicitation:</strong> You shall not solicit other agents or clients of the Company to move to a competing service during this agreement and for 1 year post-termination.')
  + zhl('於本協議期間及終止後一年內，不得誘導本公司代理人或客戶轉向競爭對手。')

  + h('4', 'Confidentiality', '保密義務')
  + en('You agree not to disclose Web人 internal business information, including pricing structures, client lists, or business strategies to any third party.')
  + zhl('您同意不向第三方洩露「Web人」之內部商業資訊，包含定價結構、客戶名單或商業策略。')

  + h('5', 'Liability &amp; Indemnity', '責任與賠償')
  + en('<strong>Service Liability:</strong> Aaron (Web人) is solely liable for the technical delivery of services to the client.')
  + zh('Aaron (Web人) 僅對提供予客戶之技術服務負責。')
  + en('<strong>Indemnity:</strong> You agree to indemnify Aaron (Web人) for any legal costs or damages arising directly from your marketing actions or misrepresentations.')
  + zhl('若因您的行銷行為或錯誤陳述導致本公司受損，您同意賠償相關法律費用及損失。')

  + h('6', 'Termination', '協議終止')
  + en('<strong>For Convenience:</strong> Either party may terminate at any time with 30 days\' notice. Commissions for active clients continue for 3 months post-termination.')
  + zh('雙方均得於 30 日前通知終止本協議。現有活躍客戶之佣金繼續發放至終止後 3 個月。')
  + en('<strong>For Cause:</strong> Fraud, spamming, or breach of confidentiality will result in immediate termination and cancellation of all pending and future payments.')
  + zhl('若有詐欺、發送垃圾郵件或洩密等違約行為，立即終止本協議並取消所有未付款項。')

  + h('7', 'Governing Law', '準據法')
  + en('This agreement is governed by the laws of Taiwan (R.O.C.) and complies with the Electronic Signatures Act. Any disputes shall be resolved in the Taipei District Court.')
  + zhl('本協議受中華民國（台灣）法律管轄，符合《電子簽章法》。如生爭議，以台灣台北地方法院為第一審管轄法院。')

  + h('8', 'Electronic Acceptance', '電子簽署確認')
  + en('By registering and downloading this contract, you confirm that:')
  + '<ul style="margin:4px 0 10px;padding-left:22px;color:#111;font-size:13px;">'
  +   '<li style="margin-bottom:5px;">You are at least 18 years of age and have the legal capacity to enter into this agreement.</li>'
  +   '<li style="margin-bottom:5px;">You have read, understood, and agree to all terms and conditions above.</li>'
  +   '<li style="margin-bottom:5px;">Your digital action constitutes a binding legal signature equivalent to a hand-written signature.</li>'
  + '</ul>'
  + zhl('透過註冊並下載本合約，您確認：已滿 18 歲且具完全行為能力；已閱讀並同意上述所有條款；您的電子操作具法律約束力，等同手寫簽名。')

  + '<div style="margin-top:36px;border-top:2px solid #111;padding-top:24px;">'
  +   '<p style="font-weight:700;font-size:15px;margin:0 0 20px;letter-spacing:0.04em;">Signatures / 簽署</p>'
  +   '<div style="display:flex;gap:48px;flex-wrap:wrap;margin-bottom:24px;">'
  +     '<div style="flex:1;min-width:200px;">'
  +       '<div style="border-bottom:1.5px solid #111;padding-bottom:4px;margin-bottom:6px;font-weight:700;font-size:14px;color:#0D9488;">' + agentName + '</div>'
  +       '<div style="font-size:11px;color:#666;">Agent Signature / 代理人簽署（電子）</div>'
  +     '</div>'
  +     '<div style="flex:1;min-width:200px;">'
  +       '<div style="border-bottom:1.5px solid #111;padding-bottom:4px;margin-bottom:6px;font-weight:700;font-size:14px;color:#0D9488;">' + signDate + '</div>'
  +       '<div style="font-size:11px;color:#666;">Date of Acceptance / 簽署日期</div>'
  +     '</div>'
  +   '</div>'
  +   '<div style="max-width:280px;">'
  +     '<div style="border-bottom:1.5px solid #111;padding-bottom:4px;margin-bottom:6px;font-weight:700;font-size:14px;">Aaron</div>'
  +     '<div style="font-size:11px;color:#666;">Company Representative / 公司代表 (Web人)</div>'
  +   '</div>'
  + '</div>'

  + '<div style="margin-top:30px;padding-top:12px;border-top:1px solid #ddd;font-size:10px;color:#aaa;text-align:center;">'
  +   'Web人 &nbsp;·&nbsp; Agent Referral Agreement &nbsp;·&nbsp; Governed by the laws of Taiwan (R.O.C.)'
  + '</div>'

  + '</div>';
}
