const wrap = "max-w-2xl mx-auto px-6 py-16 text-foreground";
const h1 = "text-3xl font-serif mb-2";
const meta = "text-sm text-muted-foreground mb-8";
const h2 = "text-xl font-serif mt-8 mb-2";
const p = "text-sm leading-relaxed text-muted-foreground";

export function Terms() {
  return (
    <main className={wrap}>
      <h1 className={h1}>Terms of Service</h1>
      <p className={meta}>Effective date: June 11, 2026</p>
      <p className={p}>
        Botanical Content is a private content-creation tool that generates
        botanical educational scripts and images and, at the operator's request,
        sends finished posts to the operator's own connected social media
        accounts as drafts.
      </p>
      <h2 className={h2}>Use of the service</h2>
      <p className={p}>
        The service is operated for its owner's own publishing workflow. By
        using it you agree to use it lawfully, to only connect social accounts
        you own or control, and to review all generated content before
        publishing. Generated content is provided as-is, with no warranty of
        accuracy.
      </p>
      <h2 className={h2}>Third-party platforms</h2>
      <p className={p}>
        When you connect a social platform (such as TikTok), your use of that
        platform remains governed by its own terms. Drafts are only created in
        accounts you have explicitly authorized via that platform's consent
        flow, and nothing is published without your manual action inside the
        platform's app.
      </p>
      <h2 className={h2}>Liability</h2>
      <p className={p}>
        The service is provided without warranties of any kind. To the maximum
        extent permitted by law, the operator is not liable for any damages
        arising from use of the service.
      </p>
      <h2 className={h2}>Contact</h2>
      <p className={p}>Questions: info@nuelementsmedia.com</p>
    </main>
  );
}

export function Privacy() {
  return (
    <main className={wrap}>
      <h1 className={h1}>Privacy Policy</h1>
      <p className={meta}>Effective date: June 11, 2026</p>
      <h2 className={h2}>What we collect</h2>
      <p className={p}>
        The service stores the content it generates (scripts, captions, and
        images) and, when you connect a social account, the OAuth tokens needed
        to create drafts in that account. Basic profile information (such as
        your platform user ID) may be stored alongside those tokens.
      </p>
      <h2 className={h2}>How it is used</h2>
      <p className={p}>
        Connected-account tokens are used solely to send content you generate to
        your own account as drafts, at your request. We do not sell data, share
        it with third parties for marketing, or post anything without your
        action.
      </p>
      <h2 className={h2}>Storage and security</h2>
      <p className={p}>
        Data is stored with our hosting provider (Supabase) with access
        restricted to the service backend. Access tokens are never exposed to
        the browser.
      </p>
      <h2 className={h2}>Deletion</h2>
      <p className={p}>
        You may disconnect a social account at any time from that platform's
        settings, which invalidates its tokens. To request deletion of stored
        data, contact us at the address below.
      </p>
      <h2 className={h2}>Contact</h2>
      <p className={p}>Questions: info@nuelementsmedia.com</p>
    </main>
  );
}
