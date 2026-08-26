'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';

type Organization = {
  id: string;
  name: string;
  country: string | null;
  websiteUrl: string | null;
  description: string | null;
  _count: {
    prizeDefinitions: number;
  };
};

type Definition = {
  id: string;
  name: string;
  organizationId: string | null;
  organization: {
    id: string;
    name: string;
  } | null;
  description: string | null;
  _count: {
    prizes: number;
  };
};

type Prize = {
  id: string;
  prizeDefinitionId: string;
  prizeDefinition: {
    id: string;
    name: string;
    organization: {
      id: string;
      name: string;
    } | null;
  };
  category: string | null;
  year: number | null;
  edition: string | null;
  place: string | null;
  description: string | null;
  refLink: string | null;
  _count: {
    games: number;
    expansions: number;
    events: number;
  };
};

type Props = {
  initialOrganizations: Organization[];
  initialDefinitions: Definition[];
  initialPrizes: Prize[];
};

type OrganizationFormState = {
  name: string;
  country: string;
  websiteUrl: string;
  description: string;
};

type DefinitionFormState = {
  name: string;
  organizationId: string;
  description: string;
};

type PrizeFormState = {
  prizeDefinitionId: string;
  category: string;
  year: string;
  edition: string;
  place: string;
  description: string;
  refLink: string;
};

function getErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null) {
    const maybeRecord = payload as Record<string, unknown>;
    if (typeof maybeRecord.error === 'string' && maybeRecord.error.trim().length > 0) {
      return maybeRecord.error;
    }
    if (typeof maybeRecord.message === 'string' && maybeRecord.message.trim().length > 0) {
      return maybeRecord.message;
    }
  }

  return fallback;
}

async function parseResponseError(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => null);
  return getErrorMessage(payload, fallback);
}

export function BoardGameAwardsManager({
  initialOrganizations,
  initialDefinitions,
  initialPrizes,
}: Props) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'organizations' | 'definitions' | 'prizes'>('organizations');

  const [organizationSearch, setOrganizationSearch] = useState('');
  const [definitionSearch, setDefinitionSearch] = useState('');
  const [prizeSearch, setPrizeSearch] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [orgDialogOpen, setOrgDialogOpen] = useState(false);
  const [editingOrganization, setEditingOrganization] = useState<Organization | null>(null);
  const [orgFormError, setOrgFormError] = useState<string | null>(null);
  const [orgForm, setOrgForm] = useState<OrganizationFormState>({
    name: '',
    country: '',
    websiteUrl: '',
    description: '',
  });

  const [definitionDialogOpen, setDefinitionDialogOpen] = useState(false);
  const [editingDefinition, setEditingDefinition] = useState<Definition | null>(null);
  const [definitionFormError, setDefinitionFormError] = useState<string | null>(null);
  const [definitionForm, setDefinitionForm] = useState<DefinitionFormState>({
    name: '',
    organizationId: '',
    description: '',
  });

  const [prizeDialogOpen, setPrizeDialogOpen] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null);
  const [prizeFormError, setPrizeFormError] = useState<string | null>(null);
  const [prizeForm, setPrizeForm] = useState<PrizeFormState>({
    prizeDefinitionId: '',
    category: '',
    year: '',
    edition: '',
    place: '',
    description: '',
    refLink: '',
  });

  const filteredOrganizations = useMemo(() => {
    const search = organizationSearch.trim().toLowerCase();
    if (!search) return initialOrganizations;

    return initialOrganizations.filter((organization) => {
      return (
        organization.name.toLowerCase().includes(search) ||
        (organization.country ?? '').toLowerCase().includes(search)
      );
    });
  }, [initialOrganizations, organizationSearch]);

  const filteredDefinitions = useMemo(() => {
    const search = definitionSearch.trim().toLowerCase();
    if (!search) return initialDefinitions;

    return initialDefinitions.filter((definition) => {
      return (
        definition.name.toLowerCase().includes(search) ||
        (definition.organization?.name ?? '').toLowerCase().includes(search)
      );
    });
  }, [initialDefinitions, definitionSearch]);

  const filteredPrizes = useMemo(() => {
    const search = prizeSearch.trim().toLowerCase();
    if (!search) return initialPrizes;

    return initialPrizes.filter((prize) => {
      return (
        prize.prizeDefinition.name.toLowerCase().includes(search) ||
        (prize.prizeDefinition.organization?.name ?? '').toLowerCase().includes(search) ||
        (prize.category ?? '').toLowerCase().includes(search) ||
        (prize.place ?? '').toLowerCase().includes(search) ||
        String(prize.year ?? '').includes(search)
      );
    });
  }, [initialPrizes, prizeSearch]);

  function openCreateOrganization() {
    setEditingOrganization(null);
    setOrgForm({
      name: '',
      country: '',
      websiteUrl: '',
      description: '',
    });
    setOrgFormError(null);
    setOrgDialogOpen(true);
  }

  function openEditOrganization(organization: Organization) {
    setEditingOrganization(organization);
    setOrgForm({
      name: organization.name,
      country: organization.country ?? '',
      websiteUrl: organization.websiteUrl ?? '',
      description: organization.description ?? '',
    });
    setOrgFormError(null);
    setOrgDialogOpen(true);
  }

  async function submitOrganization() {
    if (!orgForm.name.trim()) {
      setOrgFormError('Name is required.');
      return;
    }

    setIsSubmitting(true);
    setOrgFormError(null);

    try {
      const method = editingOrganization ? 'PUT' : 'POST';
      const url = editingOrganization
        ? `/api/board-game-prize-organizations/${editingOrganization.id}`
        : '/api/board-game-prize-organizations';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: orgForm.name.trim(),
          country: orgForm.country.trim() || null,
          websiteUrl: orgForm.websiteUrl.trim() || null,
          description: orgForm.description.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseResponseError(response, 'Failed to save organization.'));
      }

      setOrgDialogOpen(false);
      router.refresh();
    } catch (error) {
      setOrgFormError(error instanceof Error ? error.message : 'Unexpected error while saving organization.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteOrganization(organization: Organization) {
    if (organization._count.prizeDefinitions > 0) {
      alert('This organization has prize definitions and cannot be deleted.');
      return;
    }

    if (!confirm(`Delete organization "${organization.name}"?`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/board-game-prize-organizations/${organization.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(await parseResponseError(response, 'Failed to delete organization.'));
      }

      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unexpected error while deleting organization.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function openCreateDefinition() {
    setEditingDefinition(null);
    setDefinitionForm({
      name: '',
      organizationId: '',
      description: '',
    });
    setDefinitionFormError(null);
    setDefinitionDialogOpen(true);
  }

  function openEditDefinition(definition: Definition) {
    setEditingDefinition(definition);
    setDefinitionForm({
      name: definition.name,
      organizationId: definition.organizationId ?? '',
      description: definition.description ?? '',
    });
    setDefinitionFormError(null);
    setDefinitionDialogOpen(true);
  }

  async function submitDefinition() {
    if (!definitionForm.name.trim()) {
      setDefinitionFormError('Name is required.');
      return;
    }

    setIsSubmitting(true);
    setDefinitionFormError(null);

    try {
      const method = editingDefinition ? 'PUT' : 'POST';
      const url = editingDefinition
        ? `/api/board-game-prize-definitions/${editingDefinition.id}`
        : '/api/board-game-prize-definitions';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: definitionForm.name.trim(),
          organizationId: definitionForm.organizationId || null,
          description: definitionForm.description.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseResponseError(response, 'Failed to save prize definition.'));
      }

      setDefinitionDialogOpen(false);
      router.refresh();
    } catch (error) {
      setDefinitionFormError(error instanceof Error ? error.message : 'Unexpected error while saving definition.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteDefinition(definition: Definition) {
    if (definition._count.prizes > 0) {
      alert('This definition has linked prizes and cannot be deleted.');
      return;
    }

    if (!confirm(`Delete definition "${definition.name}"?`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/board-game-prize-definitions/${definition.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(await parseResponseError(response, 'Failed to delete definition.'));
      }

      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unexpected error while deleting definition.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function openCreatePrize() {
    setEditingPrize(null);
    setPrizeForm({
      prizeDefinitionId: initialDefinitions[0]?.id ?? '',
      category: '',
      year: '',
      edition: '',
      place: '',
      description: '',
      refLink: '',
    });
    setPrizeFormError(null);
    setPrizeDialogOpen(true);
  }

  function openEditPrize(prize: Prize) {
    setEditingPrize(prize);
    setPrizeForm({
      prizeDefinitionId: prize.prizeDefinitionId,
      category: prize.category ?? '',
      year: prize.year !== null ? String(prize.year) : '',
      edition: prize.edition ?? '',
      place: prize.place ?? '',
      description: prize.description ?? '',
      refLink: prize.refLink ?? '',
    });
    setPrizeFormError(null);
    setPrizeDialogOpen(true);
  }

  async function submitPrize() {
    if (!prizeForm.prizeDefinitionId) {
      setPrizeFormError('Prize definition is required.');
      return;
    }

    setIsSubmitting(true);
    setPrizeFormError(null);

    try {
      const method = editingPrize ? 'PUT' : 'POST';
      const url = editingPrize
        ? `/api/board-game-prizes/${editingPrize.id}`
        : '/api/board-game-prizes';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prizeDefinitionId: prizeForm.prizeDefinitionId,
          category: prizeForm.category.trim() || null,
          year: prizeForm.year.trim() ? Number(prizeForm.year) : null,
          edition: prizeForm.edition.trim() || null,
          place: prizeForm.place.trim() || null,
          description: prizeForm.description.trim() || null,
          refLink: prizeForm.refLink.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseResponseError(response, 'Failed to save prize.'));
      }

      setPrizeDialogOpen(false);
      router.refresh();
    } catch (error) {
      setPrizeFormError(error instanceof Error ? error.message : 'Unexpected error while saving prize.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deletePrize(prize: Prize) {
    if (prize._count.games > 0 || prize._count.expansions > 0 || prize._count.events > 0) {
      alert('This prize is linked to games, expansions, or timeline events and cannot be deleted.');
      return;
    }

    if (!confirm(`Delete prize record for "${prize.prizeDefinition.name}"?`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/board-game-prizes/${prize.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(await parseResponseError(response, 'Failed to delete prize.'));
      }

      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unexpected error while deleting prize.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
          <TabsTrigger value="definitions">Prize Definitions</TabsTrigger>
          <TabsTrigger value="prizes">Prizes</TabsTrigger>
        </TabsList>

        <TabsContent value="organizations" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Board Game Prize Organizations</CardTitle>
                  <CardDescription>
                    Manage award organizers (e.g. Spiel des Jahres, Golden Geek Awards).
                  </CardDescription>
                </div>
                <Button onClick={openCreateOrganization}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Organization
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={organizationSearch}
                  onChange={(event) => setOrganizationSearch(event.target.value)}
                  placeholder="Search organizations..."
                  className="pl-10"
                />
              </div>

              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Website</TableHead>
                      <TableHead className="text-center">Definitions</TableHead>
                      <TableHead className="w-28 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrganizations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No organizations found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredOrganizations.map((organization) => (
                        <TableRow key={organization.id}>
                          <TableCell>
                            <div className="font-medium">{organization.name}</div>
                            {organization.description && (
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {organization.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{organization.country ?? '-'}</TableCell>
                          <TableCell>
                            {organization.websiteUrl ? (
                              <a
                                href={organization.websiteUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-blue-600 hover:underline"
                              >
                                {organization.websiteUrl}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={organization._count.prizeDefinitions > 0 ? 'default' : 'secondary'}>
                              {organization._count.prizeDefinitions}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditOrganization(organization)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-600"
                                disabled={isSubmitting || organization._count.prizeDefinitions > 0}
                                onClick={() => deleteOrganization(organization)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="definitions" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Board Game Prize Definitions</CardTitle>
                  <CardDescription>
                    Manage definitions like specific award names and link them to organizations.
                  </CardDescription>
                </div>
                <Button onClick={openCreateDefinition}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Definition
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={definitionSearch}
                  onChange={(event) => setDefinitionSearch(event.target.value)}
                  placeholder="Search definitions..."
                  className="pl-10"
                />
              </div>

              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-center">Prizes</TableHead>
                      <TableHead className="w-28 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDefinitions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No definitions found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDefinitions.map((definition) => (
                        <TableRow key={definition.id}>
                          <TableCell className="font-medium">{definition.name}</TableCell>
                          <TableCell>{definition.organization?.name ?? '-'}</TableCell>
                          <TableCell>
                            <span className="line-clamp-1 text-sm text-muted-foreground">
                              {definition.description ?? '-'}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={definition._count.prizes > 0 ? 'default' : 'secondary'}>
                              {definition._count.prizes}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditDefinition(definition)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-600"
                                disabled={isSubmitting || definition._count.prizes > 0}
                                onClick={() => deleteDefinition(definition)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prizes" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Board Game Prizes</CardTitle>
                  <CardDescription>
                    Manage award records per year, category, and result (winner, nominee, etc.).
                  </CardDescription>
                </div>
                <Button onClick={openCreatePrize} disabled={initialDefinitions.length === 0}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Prize
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {initialDefinitions.length === 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Create at least one prize definition before adding prize records.
                </div>
              )}

              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={prizeSearch}
                  onChange={(event) => setPrizeSearch(event.target.value)}
                  placeholder="Search prizes..."
                  className="pl-10"
                />
              </div>

              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Definition</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Place</TableHead>
                      <TableHead className="text-center">Links</TableHead>
                      <TableHead className="w-28 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPrizes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No prizes found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPrizes.map((prize) => {
                        const totalLinks = prize._count.games + prize._count.expansions + prize._count.events;

                        return (
                          <TableRow key={prize.id}>
                            <TableCell>
                              <div className="font-medium">{prize.prizeDefinition.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {prize.prizeDefinition.organization?.name ?? 'No organization'}
                              </div>
                            </TableCell>
                            <TableCell>{prize.category ?? '-'}</TableCell>
                            <TableCell>{prize.year ?? '-'}</TableCell>
                            <TableCell>{prize.place ?? '-'}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={totalLinks > 0 ? 'default' : 'secondary'}>{totalLinks}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEditPrize(prize)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-600"
                                  disabled={isSubmitting || totalLinks > 0}
                                  onClick={() => deletePrize(prize)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={orgDialogOpen} onOpenChange={setOrgDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingOrganization ? 'Edit Organization' : 'Create Organization'}
            </DialogTitle>
            <DialogDescription>
              Define the entity that grants awards.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {orgFormError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{orgFormError}</div>
            )}

            <div className="space-y-2">
              <Label htmlFor="org-name">Name *</Label>
              <Input
                id="org-name"
                value={orgForm.name}
                onChange={(event) => setOrgForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="e.g. Spiel des Jahres"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="org-country">Country</Label>
                <Input
                  id="org-country"
                  value={orgForm.country}
                  onChange={(event) => setOrgForm((prev) => ({ ...prev, country: event.target.value }))}
                  placeholder="e.g. Germany"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-url">Website URL</Label>
                <Input
                  id="org-url"
                  value={orgForm.websiteUrl}
                  onChange={(event) => setOrgForm((prev) => ({ ...prev, websiteUrl: event.target.value }))}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-description">Description</Label>
              <Input
                id="org-description"
                value={orgForm.description}
                onChange={(event) => setOrgForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Short description of this organization"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOrgDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitOrganization} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingOrganization ? 'Save Changes' : 'Create Organization'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={definitionDialogOpen} onOpenChange={setDefinitionDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingDefinition ? 'Edit Prize Definition' : 'Create Prize Definition'}
            </DialogTitle>
            <DialogDescription>
              Define a named prize that can later have yearly/category award records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {definitionFormError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{definitionFormError}</div>
            )}

            <div className="space-y-2">
              <Label htmlFor="definition-name">Name *</Label>
              <Input
                id="definition-name"
                value={definitionForm.name}
                onChange={(event) =>
                  setDefinitionForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="e.g. Kennerspiel des Jahres"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="definition-organization">Organization</Label>
              <select
                id="definition-organization"
                value={definitionForm.organizationId}
                onChange={(event) =>
                  setDefinitionForm((prev) => ({ ...prev, organizationId: event.target.value }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {initialOrganizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="definition-description">Description</Label>
              <Input
                id="definition-description"
                value={definitionForm.description}
                onChange={(event) =>
                  setDefinitionForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Optional details"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDefinitionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitDefinition} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingDefinition ? 'Save Changes' : 'Create Definition'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={prizeDialogOpen} onOpenChange={setPrizeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPrize ? 'Edit Prize Record' : 'Create Prize Record'}</DialogTitle>
            <DialogDescription>
              Track a specific year/category/place for a prize definition.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {prizeFormError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{prizeFormError}</div>
            )}

            <div className="space-y-2">
              <Label htmlFor="prize-definition">Prize Definition *</Label>
              <select
                id="prize-definition"
                value={prizeForm.prizeDefinitionId}
                onChange={(event) =>
                  setPrizeForm((prev) => ({ ...prev, prizeDefinitionId: event.target.value }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {initialDefinitions.map((definition) => (
                  <option key={definition.id} value={definition.id}>
                    {definition.name}
                    {definition.organization ? ` (${definition.organization.name})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="prize-year">Year</Label>
                <Input
                  id="prize-year"
                  type="number"
                  value={prizeForm.year}
                  onChange={(event) => setPrizeForm((prev) => ({ ...prev, year: event.target.value }))}
                  placeholder="e.g. 2024"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prize-edition">Edition</Label>
                <Input
                  id="prize-edition"
                  value={prizeForm.edition}
                  onChange={(event) => setPrizeForm((prev) => ({ ...prev, edition: event.target.value }))}
                  placeholder="e.g. 2024"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="prize-category">Category</Label>
                <Input
                  id="prize-category"
                  value={prizeForm.category}
                  onChange={(event) => setPrizeForm((prev) => ({ ...prev, category: event.target.value }))}
                  placeholder="e.g. Best Family Game"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prize-place">Place</Label>
                <Input
                  id="prize-place"
                  value={prizeForm.place}
                  onChange={(event) => setPrizeForm((prev) => ({ ...prev, place: event.target.value }))}
                  placeholder="e.g. Winner"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prize-description">Description</Label>
              <Input
                id="prize-description"
                value={prizeForm.description}
                onChange={(event) => setPrizeForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Optional details"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prize-refLink">Reference Link</Label>
              <Input
                id="prize-refLink"
                value={prizeForm.refLink}
                onChange={(event) => setPrizeForm((prev) => ({ ...prev, refLink: event.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPrizeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitPrize} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingPrize ? 'Save Changes' : 'Create Prize'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
