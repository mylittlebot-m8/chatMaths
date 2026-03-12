import z from 'zod'

export const SubmitQuestionModel = {
  body: z.object({
    // 用户标识
    uuid: z.string().optional(),
    // 类型: error/example/test/days 等
    typ: z.string().default('days'),
    // 题目内容或聊天主要内容
    content: z.string(),
    // 多媒体素材 URL (图片等)
    imageUrl: z.string().optional(),
    // 标题 (可选)
    title: z.string().optional(),
  }),
}

export const GetQuestionsModel = {
  query: z.object({
    uuid: z.string().optional(),
    typ: z.string().optional(),
    limit: z.string().transform(Number).optional(),
    offset: z.string().transform(Number).optional(),
  }),
}
