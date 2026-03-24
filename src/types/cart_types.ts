export interface AddToCartItem {
    productId: string;
    variantId: string;
    name: string;
    imageUrl: string;
    catalogNumber: string;
    sizeLabel: string;
    unitPrice: number;
    quantity: number;
}

export interface CartItem extends AddToCartItem {
    id: string;
    quantity: number;
}