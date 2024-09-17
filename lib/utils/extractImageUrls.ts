export function extractImageUrls(markdown: string): string[] {
    const imageRegex = /!\[.*?\]\((.*?)\)/g;
    
    const matches: string[] = [];
    let match;
    
    while ((match = imageRegex.exec(markdown)) !== null) {
        matches.push(match[1]);
    }
    
    return matches;
}