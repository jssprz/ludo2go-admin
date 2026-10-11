'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export function CreateCustomerDialog() {
  const translate = useTranslations('CustomerList');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    username: '',
    preferredLanguage: ''
  });

  function handleChange(field: keyof typeof formData, value: string) {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          firstName: formData.firstName || null,
          lastName: formData.lastName || null,
          phone: formData.phone || null,
          username: formData.username || null,
          preferredLanguage: formData.preferredLanguage || null
        })
      });

      if (!res.ok) {
        setError(
          translate(res.status === 409 ? 'create.duplicate' : 'create.failed')
        );
        return;
      }

      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        phone: '',
        username: '',
        preferredLanguage: ''
      });

      setOpen(false);
      router.refresh();
    } catch {
      setError(translate('create.failed'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {translate('newCustomer')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{translate('create.title')}</DialogTitle>
          <DialogDescription>
            {translate('create.description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="p-3 rounded-md bg-destructive/10 text-destructive text-sm"
            >
              {error}
            </div>
          )}

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">
                {translate('create.email')}{' '}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">
                  {translate('create.firstName')}
                </Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">{translate('create.lastName')}</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{translate('create.phone')}</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+56 9 1234 5678"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">{translate('create.username')}</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => handleChange('username', e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">{translate('create.language')}</Label>
              <Select
                value={formData.preferredLanguage}
                onValueChange={(value) =>
                  handleChange('preferredLanguage', value)
                }
                disabled={isLoading}
              >
                <SelectTrigger id="language">
                  <SelectValue
                    placeholder={translate('create.chooseLanguage')}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">
                    {translate('create.english')}
                  </SelectItem>
                  <SelectItem value="es">
                    {translate('create.spanish')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              {translate('create.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {translate('create.creating')}
                </>
              ) : (
                translate('create.submit')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
