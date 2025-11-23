'use server';

import { deleteProductById, updateProduct } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function deleteProduct(formData: FormData) {
  let id = String(formData.get('id'));
  await deleteProductById(id);
  revalidatePath('/products');
}

export async function editProduct(formData: FormData) {
  await updateProduct({});
  revalidatePath('/products');
}