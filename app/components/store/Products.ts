import { Product } from "@/app/types/Products";
export const dummyProducts: Product[] = [
    {
        id: 1,
        name: 'Skatehive T-Shirt',
        description: 'This shirt gives you instantly shredding power',
        price: 19.99,
        imageUrls: [
            'https://i.ibb.co/h7nVNd2/image.png',
            'https://i.ibb.co/h7nVNd2/image.png',
            'https://i.ibb.co/h7nVNd2/image.png'
        ],
        category: 'Merch',
        stock: 10,
        rating: 4.5,
    },
    {
        id: 2,
        name: 'Asymetric SurfHive Board',
        description: 'If you surf in a crooked way, this board will fix it',
        price: 29.99,
        imageUrls: [
            'https://ipfs.skatehive.app/ipfs/QmUAnxW1WTrR3JZPAB3CJsgVG11sZXd8PfX14Ux8W3a353',
            'https://ipfs.skatehive.app/ipfs/QmUAnxW1WTrR3JZPAB3CJsgVG11sZXd8PfX14Ux8W3a353',
        ],
        category: 'Art',
        stock: 5,
        rating: 4.0,
    },
    {
        id: 3,
        name: 'Jantar com Jasper',
        description: 'Happy ending not included',
        price: 9.99,
        imageUrls: ['https://www.shutterstock.com/shutterstock/photos/1831879630/display_1500/stock-photo-beautifully-organized-event-round-served-table-banquet-ready-for-guests-round-decorated-table-1831879630.jpg'],
        category: 'Category 3',
        stock: 20,
        rating: 3.5,
    },
];
