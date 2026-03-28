import { useCallback, useRef, useState } from 'react';
import type { z } from 'zod';

type FieldErrors = Partial<Record<string, string>>;

export function useFormValidation<S extends z.ZodObject>(schema: S) {
  const formRef = useRef<HTMLFormElement>(null);
  const touchedRef = useRef(new Set<string>());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isValid, setIsValid] = useState(false);

  const getValues = useCallback((): Record<string, unknown> => {
    if (!formRef.current) {
      return {};
    }

    return Object.fromEntries(new FormData(formRef.current).entries());
  }, []);

  const recheckValidity = useCallback(() => {
    setIsValid(schema.safeParse(getValues()).success);
  }, [schema, getValues]);

  const validateField = useCallback(
    (name: string) => {
      const fieldSchema = (schema.shape as Record<string, z.ZodType>)[name];

      if (!fieldSchema) {
        return;
      }

      const value = getValues()[name];
      const result = fieldSchema.safeParse(value);

      setErrors((prev) => {
        if (result.success) {
          if (!prev[name]) {
            return prev;
          }

          const next = { ...prev };

          delete next[name];

          return next;
        }

        const msg = result.error.issues[0]?.message ?? 'Невалидное значение';

        return prev[name] === msg ? prev : { ...prev, [name]: msg };
      });

      recheckValidity();
    },
    [schema, getValues, recheckValidity],
  );

  const onBlur = useCallback(
    (name: string) => {
      const value = getValues()[name];

      if (typeof value === 'string' && !value) {
        return;
      }

      touchedRef.current.add(name);
      validateField(name);
    },
    [getValues, validateField],
  );

  const onChange = useCallback(
    (name: string) => {
      recheckValidity();

      if (touchedRef.current.has(name)) {
        validateField(name);
      } else {
        setErrors((prev) => {
          if (!prev[name]) {
            return prev;
          }

          const next = { ...prev };

          delete next[name];

          return next;
        });
      }
    },
    [validateField, recheckValidity],
  );

  const validateAll = useCallback((): z.infer<S> | null => {
    const result = schema.safeParse(getValues());

    if (result.success) {
      setErrors({});
      setIsValid(true);

      return result.data as z.infer<S>;
    }

    const flat = result.error.flatten().fieldErrors;
    const mapped: FieldErrors = {};

    for (const [key, msgs] of Object.entries(flat)) {
      if (msgs?.length) {
        mapped[key] = msgs[0];
        touchedRef.current.add(key);
      }
    }

    setErrors(mapped);
    setIsValid(false);

    return null;
  }, [schema, getValues]);

  return { formRef, errors, isValid, onBlur, onChange, validateAll };
}
