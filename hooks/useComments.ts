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

const arraysAreEqual = (arr1: any[], arr2: any[]): boolean => {
    return JSON.stringify(arr1) === JSON.stringify(arr2);
};

const loadComments = async (): Promise<Comment[]> => {
    const paramsArray = {
        start: [
            'xvlad',
            'nxvsjarvmp',
            lastChildAuthor,
            lastChildPermLink,
        ],
        limit: 500,
        order: "by_root",
    };

    if (!arraysAreEqual(lastStartParameter, paramsArray.start)) {
        lastStartParameter = [...paramsArray.start]; // Salva o novo estado de 'start'
        
        const commentsResponse = await HiveClient.call(
            "database_api", 
            "list_comments", 
            paramsArray
        ) as { comments: Comment[] };

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
                allLoadedComments.pop();
            }
            allLoadedComments = allLoadedComments.concat(comments);

            const lastComment = comments[comments.length - 1];
            lastChildAuthor = lastComment.author;
            lastChildPermLink = lastComment.permlink;

            console.log("Carregando Comentarios... ", allLoadedComments.length);
        } else {
            hasMoreComments = false; // Para o loop se não houver mais comentários
        }
    } while (hasMoreComments);

    // Ordena todos os comentários carregados
    allLoadedComments.sort((a: Comment, b: Comment) => {
        return new Date(b.created).getTime() - new Date(a.created).getTime();
    });

    console.log("Comentários ordenados:", allLoadedComments.length);
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

    const fetchAndUpdateComments = useCallback(async () => {
        setIsLoading(true);
        try {
            const fetchedComments = await fetchComments(page, pageSize);
            setComments((prevComments) => [...prevComments, ...fetchedComments]);
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
