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
    /**
     * What the shelf holds, when the server has said.
     *
     * Optional because a line rendered optimistically - added a moment ago and
     * not yet acknowledged - has no answer for it yet, and because the two
     * repos deploy independently.
     */
    available?: number;
    /** True when this line asks for more than `available`. */
    overStock?: boolean;
}