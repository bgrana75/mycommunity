"use client";
import { getFileSignature, uploadImage } from '@/lib/hive/client-functions';
import { Box } from '@chakra-ui/react';
import {
    headingsPlugin,
    listsPlugin,
    quotePlugin,
    thematicBreakPlugin,
    markdownShortcutPlugin,
    MDXEditor,
    type MDXEditorMethods,
    type MDXEditorProps,
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
    InsertSandpack,
    sandpackPlugin,
    InsertCodeBlock,
    InsertThematicBreak
  } from '@mdxeditor/editor'
import { UndoRedo, BoldItalicUnderlineToggles, toolbarPlugin } from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'

import { FC } from "react";

interface EditorProps {
  markdown: string;
  editorRef?: React.MutableRefObject<MDXEditorMethods | null>;
  setMarkdown: (markdown: string) => void;
}

const Editor: FC<EditorProps> = ({ markdown, editorRef, setMarkdown }) => {

    async function imageUploadHandler(image: File) {
        const signature = await getFileSignature(image);
        const uploadUrl = await uploadImage(image, signature);
        return uploadUrl
    }

    return (
    <MDXEditor
      placeholder="Type your post here..."
      className='w-full h-full'
      onChange={(e) => setMarkdown(e)}
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
        listsPlugin(),
        thematicBreakPlugin(),
        imagePlugin({ imageUploadHandler }),
        diffSourcePlugin({
            diffMarkdown: markdown,
            viewMode: 'rich-text',
            readOnlyDiff: true
          }),
        toolbarPlugin({
            toolbarContents: () => (
                <>
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
                </>
            )
          })
      ]}
    />
  );
};

export default Editor;
