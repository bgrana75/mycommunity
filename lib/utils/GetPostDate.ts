export function getPostDate(date: string | Date): string {
    const today = new Date();
    const created = new Date(date);

    const offset = today.getTimezoneOffset();
    const adjustedToday = new Date(today.getTime() + offset * 60000);

    const diffMs = adjustedToday.getTime() - created.getTime(); // milliseconds between now & then
    const diffDays = Math.floor(diffMs / 86400000); // days
    const diffHrs = Math.floor(diffMs / 3600000); // hours
    const diffMins = Math.round(diffMs / 60000); // minutes

    let postCreated = "";

    if (diffMins < 60) {
        postCreated = `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    } else if (diffHrs < 24) {
        postCreated = `${diffHrs} hour${diffHrs > 1 ? 's' : ''} ago`;
    } else if (diffDays < 31) {
        postCreated = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
        postCreated = `${created.getDate()}/${created.getMonth() + 1}/${created.getFullYear()}`;
    }

    return postCreated;
}