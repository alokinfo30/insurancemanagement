#!/usr/bin/env bash
set -e

python manage.py migrate
python manage.py collectstatic --noinput

python manage.py shell <<'PY'
import os
from django.contrib.auth import get_user_model

User = get_user_model()

username = os.environ["DJANGO_SUPERUSER_USERNAME"]
email = os.environ["DJANGO_SUPERUSER_EMAIL"]
password = os.environ["DJANGO_SUPERUSER_PASSWORD"]

user, created = User.objects.get_or_create(
    username=username,
    defaults={
        "email": email,
        "is_staff": True,
        "is_superuser": True,
    },
)

if created:
    user.set_password(password)
    user.save()
elif not user.is_staff or not user.is_superuser:
    user.is_staff = True
    user.is_superuser = True
    user.set_password(password)
    user.save()
PY

gunicorn insurancemanagement.wsgi:application
