import {
    Box,
    Button,
    Input,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    Text,
    HStack,
    Avatar,
    Link,
} from '@chakra-ui/react';
import React, { useEffect, useState } from 'react';
import TweetComposer from './TweetComposer';
import { Comment } from '@hiveio/dhive';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import DOMPurify from 'dompurify';

interface TweetReplyModalProps {
    isOpen: boolean;
    onClose: () => void;
    comment?: Comment;
}

export default function TweetReplyModal({ isOpen, onClose, comment }: TweetReplyModalProps) {

    /*
    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
            handleTweetReply();
        }
    };
    */

    const handleTweetReply = async () => {

    };

    if (!comment) {
        return (
            <div></div>
        )
    }

    const sanitizedBody = DOMPurify.sanitize(comment.body);

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <ModalOverlay bg="rgba(0, 0, 0, 0.6)" backdropFilter="blur(10px)" />
            <ModalContent>
                <ModalHeader>
                <HStack mb={2}>
                <Avatar size="sm" name={comment.author} />
                <Link href={`/profile/${comment.author}`} fontWeight="bold" mb={2}>
                    {comment.author}
                </Link>
            </HStack>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
            >
                {sanitizedBody}
            </ReactMarkdown>
                </ModalHeader>
                <ModalBody>
                    <TweetComposer pa={comment?.author} pp={comment?.permlink} />
                </ModalBody>
                <ModalFooter>
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
