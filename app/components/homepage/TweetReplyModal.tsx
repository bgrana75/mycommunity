import { Modal, ModalBody, ModalContent, ModalHeader, ModalOverlay, HStack, Avatar, Link, IconButton } from '@chakra-ui/react';
import React from 'react';
import TweetComposer from './TweetComposer';
import { Comment } from '@hiveio/dhive';
import { CloseIcon } from '@chakra-ui/icons';
import { MarkdownRenderer } from '../MarkdownRenderer';

interface TweetReplyModalProps {
    isOpen: boolean;
    onClose: () => void;
    comment?: Comment;
    onNewReply: (newComment: Partial<Comment>) => void;
}

export default function TweetReplyModal({ isOpen, onClose, comment, onNewReply }: TweetReplyModalProps) {

    if (!comment) {
        return <div></div>;
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg">
            <ModalOverlay bg="rgba(0, 0, 0, 0.6)" backdropFilter="blur(10px)" />
            <ModalContent bg="background" color="text" position="relative">
                <IconButton
                    aria-label="Close"
                    icon={<CloseIcon />}
                    onClick={onClose}
                    position="absolute"
                    top={2}
                    right={2}
                    variant="unstyled"
                    size="lg"
                    border="none"
                />
                <ModalHeader>
                    <HStack mb={2}>
                        <Avatar size="sm" name={comment.author} />
                        <Link href={`/profile/${comment.author}`} fontWeight="bold" mb={2}>
                            {comment.author}
                        </Link>
                    </HStack>
                    <MarkdownRenderer>{comment.body}</MarkdownRenderer>
                </ModalHeader>
                <ModalBody>
                    <TweetComposer pa={comment.author} pp={comment.permlink} onNewComment={onNewReply} post={true} />
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}
