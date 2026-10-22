export type AuthFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const AUTH_FORM_STATE_INICIAL: AuthFormState = { status: "idle" };
