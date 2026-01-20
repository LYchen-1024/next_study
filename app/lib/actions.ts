'use server'
import { z } from 'zod';
import postgres from 'postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });
const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({invalid_type_error:'please select a customer'}),
    amount: z.coerce.number().gt(0, {message:'Please enter a amount greater than $0'}),
    status: z.enum(['pending', 'paid'],{invalid_type_error:'please select an invoice status'}),
    date: z.string(),
});
const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true,date: true });

export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
};
//将身份验证逻辑与登录表单连接
export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}

//创建发票
export async function createInvoice(prevState: State, formData: FormData) {
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    })
    // 如果表单验证失败，则尽早返回错误信息。否则，继续进行下一步操作。
    if (!validatedFields.success) {
        return {
        errors: validatedFields.error.flatten().fieldErrors,
        message: 'Missing Fields. Failed to Create Invoice.',
        };
    }
    // 准备数据以将其插入数据库中
    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0]

    try{
       await sql`
            INSERT INTO invoices (customer_id, amount, status, date)
            VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `; 
    }catch(error){
        console.error('创建发票失败：',error);
        throw new Error('Database Error: Failed to Create Invoice.');
    }
    // 重新验证发票页面的缓存，并将用户重新导向该页面。
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
    // Test it out
}
//更新发票
export async function updateInvoice(id: string, formData: FormData) {
    const {customerId, amount, status} = UpdateInvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    })
    const amountInCents = amount * 100

    try{
        await sql `
            UPDATE invoices
            SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
            WHERE id = ${id}
        `
    }catch(error){
        console.log('更新发票失败：',error)
        throw new Error('Database Error: Failed to Update Invoice.')
    }
    revalidatePath('/dashboard/invoices')
    redirect('/dashboard/invoices')
}
//删除发票
export async function deleteInvoice(id: string) {
    
    try{
        await sql`DELETE FROM invoices WHERE id = ${id}`
        revalidatePath('/dashboard/invoices')
    }catch(error){
        console.error('删除发票失败：', error)
        throw new Error('Failed to Delete Invoice')
    }
    
}

