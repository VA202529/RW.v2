# Webshop stock model

BarberFlow decrements product stock when `create-order` creates a `pending_payment` order. That means `products.stock` is always the live available stock: physical stock minus active checkout holds.

The hold window is 15 minutes. If payment succeeds, the stock remains consumed and the order becomes `paid`. If the Checkout Session expires, payment fails, the customer cancels, or the cron garbage collector supersedes an old order, BarberFlow restores stock from `order_items.quantity`.

Stock is decremented atomically in the database. `create-order` locks and checks every product before inserting the order, then updates each product with `stock = stock - quantity where stock >= quantity`. If any item cannot be fulfilled, the whole order creation fails with `OUT_OF_STOCK`.

Admin stock changes are additive. An admin enters `+10` or `-3`; the database applies that delta only when the result would remain non-negative.
