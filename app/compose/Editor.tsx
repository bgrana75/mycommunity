'use client';
import { FC } from "react";
import { getFileSignature, uploadImage } from '@/lib/hive/client-functions';
import {
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  MDXEditor,
  type MDXEditorMethods,
  imagePlugin,
  InsertImage,
  DiffSourceToggleWrapper,
  diffSourcePlugin,
  BlockTypeSelect,
  tablePlugin,
  InsertTable,
  CodeToggle,
  linkDialogPlugin,
  CreateLink,
  ListsToggle,
  InsertThematicBreak,
  codeMirrorPlugin,
  codeBlockPlugin,
} from '@mdxeditor/editor';
import { UndoRedo, BoldItalicUnderlineToggles, toolbarPlugin } from '@mdxeditor/editor';
import { Box } from '@chakra-ui/react';
import '@mdxeditor/editor/style.css';

interface EditorProps {
  markdown: string;
  editorRef?: React.MutableRefObject<MDXEditorMethods | null>;
  setMarkdown: (markdown: string) => void;
}

const Editor: FC<EditorProps> = ({ markdown, editorRef, setMarkdown }) => {
  async function imageUploadHandler(image: File) {
    const signature = await getFileSignature(image);
    const uploadUrl = await uploadImage(image, signature);
    return uploadUrl;
  }

  const transformYoutubeLink = (url: string) => {
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|[^/]+[?&]v=)|youtu\.be\/)([^"&?/ ]{11})/g;
    const match = url.match(youtubeRegex);
    if (match) {
      const youtubeId = match[0].split('v=')[1] || match[0].split('/').pop();
      return `https://www.youtube.com/embed/${youtubeId}`;
    }
    return url;
  }

  const handleMarkdownChange = (newMarkdown: string) => {
    // Transform YouTube links in the markdown content
    const transformedMarkdown = newMarkdown.replace(
      /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|[^/]+[?&]v=)|youtu\.be\/)([^"&?/ ]{11}))/g,
      (match) => `<iframe width="560" height="315" src="${transformYoutubeLink(match)}" frameborder="0" allowfullscreen></iframe>`
    );
    setMarkdown(transformedMarkdown);
  }

  return (
    <Box
      className="w-full h-full bg-background"
      sx={{
        color: 'primary',
        '& .mdx-editor-content': {
          color: 'primary',
          '& h1': { fontSize: '4xl' },
          '& h2': { fontSize: '3xl' },
          '& h3': { fontSize: '2xl' },
          '& h4': { fontSize: 'xl' },
          '& h5': { fontSize: 'lg' },
          '& h6': { fontSize: 'md' },
          fontFamily: 'body',
          '& blockquote': {
            borderLeft: '4px solid',
            borderColor: 'primary',
            paddingLeft: 4,
            margin: 0,
          },
          // style for links
          '& a': {
            color: 'blue',
            textDecoration: 'underline',
          },
        },
      }}
    >
      <MDXEditor
        placeholder="Type your post here..."
        contentEditableClassName="mdx-editor-content"
        onChange={handleMarkdownChange}
        ref={editorRef}
        markdown={markdown}
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          markdownShortcutPlugin(),
          tablePlugin(),
          linkDialogPlugin(),
          codeBlockPlugin(),
          codeMirrorPlugin({ codeBlockLanguages: { js: 'JavaScript', css: 'CSS', txt: 'text', tsx: 'TypeScript' } }),
          imagePlugin({ imageUploadHandler }),
          diffSourcePlugin({
            diffMarkdown: markdown,
            viewMode: 'rich-text',
            readOnlyDiff: false,
          }),
          toolbarPlugin({
            toolbarContents: () => (
              <DiffSourceToggleWrapper>
                <UndoRedo />
                <BlockTypeSelect />
                <BoldItalicUnderlineToggles />
                <InsertTable />
                <CodeToggle />
                <ListsToggle />
                <CreateLink />
                <InsertThematicBreak />
                <InsertImage />
              </DiffSourceToggleWrapper>
            ),
          }),
        ]}
      />
    </Box>
  );
};

export default Editor;
