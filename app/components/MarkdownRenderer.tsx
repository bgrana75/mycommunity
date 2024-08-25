import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import DOMPurify from 'dompurify';

export function MarkdownRenderer({ children }: { children: string }) {
    const sanitizedBody = DOMPurify.sanitize(children);
    return (
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {sanitizedBody}
        </ReactMarkdown>
    )
}