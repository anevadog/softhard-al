export type FormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const FORM_STATE_INICIAL: FormState = { status: "idle" };
