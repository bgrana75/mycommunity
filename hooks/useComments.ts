/*
Explicação do Código

Carregamento de Comentários:

1) A ideia aqui é de carregar todos os comentarios do post;
2) Somente entao, vamos organizar por data decrescente, tendo mais novo primeiro,
3) mas nao vamos renderizar todos, vamos aguardar o frontend pedir a proxima pagina
4) Paginas de 50 definidos inicialmente.

fetchAllComments: Carrega todos os comentários e os ordena por data.
fetchComments: Retorna os comentários paginados com base no page e pageSize.

State de Paginação:
page: Mantém o controle da página atual.
pageSize: Define quantos comentários devem ser carregados por vez (50 neste caso).

Paginação no Hook:
A função fetchAndUpdateComments é chamada sempre que a página (page) muda, carregando os próximos 50 comentários.
A função loadMoreComments incrementa o número da página, disparando uma nova busca de comentários.
Botão de "Carregar Mais":

No front-end, você pode usar a função loadMoreComments para carregar os próximos comentários quando o botão "Carregar Mais" for clicado.

Melhorias, os await parecem nao estar funcionando. precisamos ver isso pois ele executa 
    console.log("Carregando Comentarios... ", allLoadedComments.length);
umas 50x ate ter resposta da api.

*/

'use client'
import HiveClient from "@/lib/hive/hiveclient"
import { useCallback, useEffect, useState } from "react"
import { Comment } from "@hiveio/dhive"

let allLoadedComments: Comment[] = [];
let lastChildAuthor = '';
let lastChildPermLink = '';
let lastStartParameter: any[] = [];

// start with production tweet tread @xvlad/nxvsjarvmp
var paramsFetchTweetsByRoot = {
    start: [
        'skatedev',
        'test-post-for-new-community',   
        // 'xvlad',
        // 'nxvsjarvmp',   
        lastChildAuthor,
        lastChildPermLink,
    ],
    limit: 500,
    order: "by_root",
};

var paramsFetchTweetsByLink = {
    start: [
        'skatedev',
        're-skatedev-sidr6t',        
        //lastChildAuthor,
        //lastChildPermLink,
    ],
    limit: 500,
    order: "by_permlink",
};

var paramsFetchTweetsByParent = {
    start: [
        'skatedev',
        'test-post-for-new-community',    
        lastChildAuthor,
        lastChildPermLink,
    ],
    limit: 500,
    order: "by_parent",
};

var paramsFetchTweets = paramsFetchTweetsByRoot;

function organizeComments(comments: Comment[]): Comment[] {
    // First, sort the comments by depth and creation date
    comments.sort((a, b) => {
        // If depths are different, prioritize lower depth (higher priority to depth 1)
        if (a.depth !== b.depth) {
            return a.depth - b.depth;
        }
        // If depths are the same, sort by created date in descending order (most recent first)
        return new Date(b.created).getTime() - new Date(a.created).getTime();
    });

    // Next, link the depth 2 comments to their corresponding depth 1 comment
    const organizedComments: Comment[] = [];
    const commentMap = new Map<string, Comment[]>();

    comments.forEach(comment => {
        if (comment.depth === 1) {
            // Add depth 1 comments directly to the organized array
            organizedComments.push(comment);
            commentMap.set(comment.permlink, []);
        } else if (comment.depth >= 2) {
            // Add depth 2 comments under their parent permlink
            const parentPermlink = comment.parent_permlink;
            if (commentMap.has(parentPermlink)) {
                commentMap.get(parentPermlink)?.push(comment);
            }
        }
    });

    // Flatten the organized comments, including replies under their parent
    const finalComments: Comment[] = [];
    organizedComments.forEach(comment => {
        finalComments.push(comment);
        if (commentMap.has(comment.permlink)) {
            finalComments.push(...(commentMap.get(comment.permlink) || []));
        }
    });

    return finalComments;
}


const arraysAreEqual = (arr1: any[], arr2: any[]): boolean => {
    return JSON.stringify(arr1) === JSON.stringify(arr2);
};

const loadComments = async (): Promise<Comment[]> => {
    if (!arraysAreEqual(lastStartParameter, paramsFetchTweets.start)) {
        lastStartParameter = [...paramsFetchTweets.start]; // Salva o novo estado de 'start'
        
        const commentsResponse = await HiveClient.call(
            "database_api", 
            "list_comments", 
            paramsFetchTweets
        ) as { comments: Comment[] };

        //console.log(commentsResponse.comments);
        return commentsResponse.comments;
    }

    return []; // Retorna vazio se a solicitação já foi feita
};

const fetchAllComments = async (): Promise<void> => {
    let hasMoreComments = true;

    do {
        const comments = await loadComments(); // Espera a resposta antes de continuar

        if (comments.length > 0) {
            // Remove o último comentário carregado anteriormente, se houver
            if (allLoadedComments.length > 0) {
                //allLoadedComments.pop();
            }
            allLoadedComments = allLoadedComments.concat(comments);

            const lastComment = comments[comments.length - 1];
            lastChildAuthor = lastComment.author;
            lastChildPermLink = lastComment.permlink;
            hasMoreComments = true;
            console.log("Carregando Comentarios... ", allLoadedComments.length);
        } else {
            hasMoreComments = false; // Para o loop se não houver mais comentários
        }
    } while (hasMoreComments);

    // Ordena todos os comentários carregados
    /*
    allLoadedComments.sort((a: Comment, b: Comment) => {
        return new Date(b.created).getTime() - new Date(a.created).getTime();
    });
    */
    
    //allLoadedComments.reverse();

    allLoadedComments = organizeComments(allLoadedComments);

    // console.log("Comentários ordenados:", allLoadedComments.length);
    // console.log("Comentario mais novo:" + allLoadedComments[length-1]);
    // console.log(allLoadedComments);
    
    //console.log(allLoadedComments[3]);
};

async function fetchComments(page: number, pageSize: number): Promise<Comment[]> {
    if (allLoadedComments.length === 0) {
        await fetchAllComments(); // Garante que todos os comentários sejam carregados antes de continuar
    }

    // Paginação: Retorna um slice dos comentários para a página atual
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return allLoadedComments.slice(startIndex, endIndex);
}

export function useComments(
    author: string,
    permlink: string,
    recursive: boolean = false
) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const pageSize = 50;

    /*
    if (author && permlink) {
        paramsFetchTweets = {
            start: [ author, permlink, '', '', ],
            limit: 500,
            order: "by_root",
        };
    }*/

    const fetchAndUpdateComments = useCallback(async () => {
        setIsLoading(true);
        try {
            const fetchedComments = await fetchComments(page, pageSize);
            const organizedComments = organizeComments(fetchedComments);

            setComments((prevComments) => [...prevComments, ...organizedComments]);
            setIsLoading(false);
        } catch (err: any) {
            setError(err.message ? err.message : "Error loading comments");
            console.error(err);
            setIsLoading(false);
        }
    }, [page]);

    
    useEffect(() => {
        fetchAndUpdateComments();
    }, [fetchAndUpdateComments]);
    

    const loadMoreComments = useCallback(() => {
        setPage((prevPage) => prevPage + 1);
    }, []);

    return {
        comments,
        error,
        isLoading,
        loadMoreComments,
    };
}
