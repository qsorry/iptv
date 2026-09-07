export { createProduct } from "./application/create-product";
export { importProducts, mapCsvRows, type ImportRow, type ImportResult } from "./application/import-products";
export { updateProduct, deleteProduct, addProductImageUrl, removeProductImage, setPrimaryImage, addVariant, removeVariant } from "./application/update-product";
export { uploadProductImages } from "./application/upload-images";
export { productRepository, UNCATEGORIZED } from "./infrastructure/product.repository";
export * from "./validations/product.schema";
export {
  createCategory,
  listCategories,
  listCategoriesWithCounts,
  updateCategory,
  uploadCategoryImage,
  removeCategoryImage,
  deleteCategory,
  setProductsCategory,
  listPublicCategories,
  categoryProducts,
  categoryById,
  type UpdateCategoryInput,
} from "./application/categories";
