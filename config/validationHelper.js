function validationError(error) {
    if (!error?.errors) {
        return error.message;
    }

    return Object.values(error.errors)
        .map((err) => {
            switch (err.path) {
                case "mainImageId":
                    return "Main image is required";

                case "fabric":
                    return "Fabric is required";

                case "name":
                    return "Product name is required";

                case "sku":
                    return "SKU is required";

                case "price":
                    return "Price is required";

                case "stock":
                    return "Stock cannot be negative";

                default:
                    return err.message;
            }
        })
        .join(", ");
}

module.exports = {
    validationError,
};