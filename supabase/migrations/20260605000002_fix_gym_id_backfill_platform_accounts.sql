-- Primera pasada: via email como puente
UPDATE platform_accounts pa
SET gym_id = p.gym_id
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE u.email = pa.email
AND pa.gym_id IS NULL
AND p.gym_id IS NOT NULL;

-- Segunda pasada: via auth_user_id directo (cubre emails históricos distintos)
UPDATE platform_accounts pa
SET gym_id = p.gym_id
FROM profiles p
WHERE p.id = pa.auth_user_id
AND pa.gym_id IS NULL
AND p.gym_id IS NOT NULL;
