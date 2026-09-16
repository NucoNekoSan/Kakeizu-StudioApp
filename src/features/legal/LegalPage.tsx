import { Link, useParams } from "react-router-dom";
import { Notice } from "../../components/ui";
import { legalDocuments, type LegalSlug } from "./legalContent";
import { hasUnsetPublisherFields, publisher } from "./publisher";

/**
 * 利用規約とプライバシーポリシーの表示。
 *
 * Shell（アプリの外枠）を使わないのは、保存モードを選ぶ前でも
 * 読めるようにしているため。ナビゲーションは自前の戻りリンクで足りる。
 */
export default function LegalPage({ slug }: { slug?: LegalSlug }) {
  const params = useParams();
  const key = (slug ?? params.slug) as LegalSlug | undefined;
  const document = key ? legalDocuments[key] : undefined;

  if (!document)
    return (
      <div className="document-page">
        <Notice tone="error">文書が見つかりません。</Notice>
        <Link to="/charts">相関図に戻る</Link>
      </div>
    );

  return (
    <div className="document-page">
      <article className="document">
        <header>
          <h1>{document.title}</h1>
          <p className="document-revised">最終改定日: {publisher.revisedOn}</p>
        </header>

        {hasUnsetPublisherFields() && (
          <Notice tone="error">
            提供者名と連絡先が未設定です。公開前に設定してください。
          </Notice>
        )}

        <p className="document-lead">{document.lead}</p>

        {document.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.list && (
              <ul>
                {section.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <footer className="document-footer">
          <Link to={document.slug === "terms" ? "/privacy" : "/terms"}>
            {document.slug === "terms" ? "プライバシーポリシー" : "利用規約"}
          </Link>
          <Link to="/help">使い方</Link>
          <Link to="/charts">相関図に戻る</Link>
        </footer>
      </article>
    </div>
  );
}
