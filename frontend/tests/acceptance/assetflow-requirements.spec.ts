import { test, expect, APIRequestContext, APIResponse } from '@playwright/test'

type Credentials = {
  login: string
  password: string
}

type Headers = Record<string, string>

type Asset = {
  inventoryNo: string
  typeId: number
  manufacturer: string
  model: string
  serialNumber: string
  purchaseDate: string
  cost: number
  statusId: number
  vendorName?: string
  receiptActNo?: string
}

type Software = {
  id: number
  name: string
  version: string
  licenseTypeId: number
  licenseIdentifier?: string
  licenseStart?: string
  licenseEnd?: string | null
  licenseStatus?: string
}

type Ticket = {
  ticketNo: string
  type: string
  authorEmployeeNo: string
  assigneeEmployeeNo?: string | null
  assetInventoryNo?: string
  softwareId?: number
  targetSoftwareVersion?: string
  statusId: number
  closedAt?: string | null
}

type Employee = {
  employeeNo: string
  lastName: string
  firstName: string
  patronymic?: string
  fullName: string
  position: string
  department: string
  login: string
  roleId: number
}

type MovementAct = {
  actNo: string
  assetInventoryNo: string
  employeeNo: string
  actorEmployeeNo?: string
  movementType: 'ISSUE' | 'RETURN'
  movementDate: string
  relatedActNo?: string | null
}

type WriteOffAct = {
  actNo: string
  assetInventoryNo: string
  reason: string
  writeOffDate: string
}

const users = {
  employee: { login: 'user', password: 'user' },
  specialist: { login: 'admin', password: 'admin' },
  manager: { login: 'manager', password: 'manager' },
  hr: { login: 'hr', password: 'hr' },
} satisfies Record<string, Credentials>

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function pastIso(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

function futureIso(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

async function expectOk(response: APIResponse) {
  if (!response.ok()) {
    const body = await response.text()
    expect(response.ok(), `${response.status()} ${body}`).toBeTruthy()
  }
}

async function login(request: APIRequestContext, credentials: Credentials) {
  const response = await request.post('/auth/login', { data: credentials })
  await expectOk(response)
  const body = await response.json()
  return body.accessToken as string
}

async function authHeaders(request: APIRequestContext, credentials: Credentials): Promise<Headers> {
  const token = await login(request, credentials)
  return { Authorization: `Bearer ${token}` }
}

async function referenceRows(request: APIRequestContext, headers: Headers, path: string) {
  const response = await request.get(path, { headers })
  await expectOk(response)
  return response.json()
}

async function referenceId(request: APIRequestContext, headers: Headers, path: string, name: string) {
  const rows = await referenceRows(request, headers, path)
  const row = rows.find((item: { name: string }) => item.name === name)
  expect(row, `Не найден справочник ${path}: ${name}`).toBeTruthy()
  return row.id as number
}

async function statusId(request: APIRequestContext, headers: Headers, name: string) {
  return referenceId(request, headers, '/reference/asset-statuses', name)
}

async function ticketStatusId(request: APIRequestContext, headers: Headers, name: string) {
  return referenceId(request, headers, '/reference/ticket-statuses', name)
}

async function createAsset(request: APIRequestContext, headers: Headers, suffix: string): Promise<Asset> {
  const typeId = await referenceId(request, headers, '/reference/asset-types', 'Ноутбук')
  const response = await request.post('/assets', {
    headers,
    data: {
      typeId,
      manufacturer: 'TestVendor',
      model: `Acceptance-${suffix}`,
      serialNumber: `SN-ACC-${suffix}`,
      purchaseDate: todayIso(),
      cost: 100000,
      vendorName: 'Acceptance Test',
    },
  })
  await expectOk(response)
  return response.json()
}

async function updateAsset(request: APIRequestContext, headers: Headers, asset: Asset, suffix: string): Promise<Asset> {
  const response = await request.put(`/assets/${asset.inventoryNo}`, {
    headers,
    data: {
      typeId: asset.typeId,
      manufacturer: asset.manufacturer,
      model: `Acceptance-Updated-${suffix}`,
      serialNumber: asset.serialNumber,
      purchaseDate: asset.purchaseDate,
      cost: 120000,
      vendorName: 'Acceptance Test Updated',
    },
  })
  await expectOk(response)
  return response.json()
}

async function createSoftware(
  request: APIRequestContext,
  headers: Headers,
  suffix: string,
  version = '1.0.0',
  licenseEnd: string | null = null,
  productName = `Acceptance Software ${suffix}`,
): Promise<Software> {
  const licenseTypeId = await referenceId(request, headers, '/reference/license-types', 'Бессрочная')
  const response = await request.post('/software', {
    headers,
    data: {
      name: productName,
      version,
      licenseTypeId,
      licenseIdentifier: `ACC-${suffix}-${version}`,
      licenseStart: todayIso(),
      licenseEnd,
    },
  })
  await expectOk(response)
  return response.json()
}

async function updateSoftware(request: APIRequestContext, headers: Headers, software: Software, suffix: string): Promise<Software> {
  const response = await request.put(`/software/${software.id}`, {
    headers,
    data: {
      name: software.name,
      version: software.version,
      licenseTypeId: software.licenseTypeId,
      licenseIdentifier: `ACC-UPDATED-${suffix}`,
      licenseStart: todayIso(),
      licenseEnd: futureIso(60),
    },
  })
  await expectOk(response)
  return response.json()
}

async function createTicket(
  request: APIRequestContext,
  headers: Headers,
  data: {
    type: string
    category?: string
    assetInventoryNo?: string
    softwareId?: number
    targetSoftwareVersion?: string
    justification?: string
  },
): Promise<Ticket> {
  const response = await request.post('/tickets', { headers, data })
  await expectOk(response)
  return response.json()
}

async function assignTicket(request: APIRequestContext, headers: Headers, ticketNo: string): Promise<Ticket> {
  const response = await request.post(`/tickets/${ticketNo}/assign-to-me`, { headers })
  await expectOk(response)
  return response.json()
}

async function closeTicket(request: APIRequestContext, headers: Headers, ticketNo: string): Promise<Ticket> {
  const response = await request.post(`/tickets/${ticketNo}/status`, {
    headers,
    data: {
      statusName: 'Выполнена',
      comment: 'Заявка выполнена в рамках acceptance-теста',
      keepInRepair: false,
    },
  })
  await expectOk(response)
  return response.json()
}

async function issueAsset(request: APIRequestContext, headers: Headers, inventoryNo: string, employeeNo = '000002'): Promise<MovementAct> {
  const response = await request.post('/acts/movement/issue', {
    headers,
    data: {
      inventoryNo,
      employeeNo,
      issueDate: todayIso(),
    },
  })
  await expectOk(response)
  return response.json()
}

async function returnAsset(request: APIRequestContext, headers: Headers, actNo: string): Promise<MovementAct> {
  const response = await request.post(`/acts/movement/${actNo}/return`, {
    headers,
    data: { returnDate: todayIso() },
  })
  await expectOk(response)
  return response.json()
}

async function writeOffAsset(request: APIRequestContext, headers: Headers, inventoryNo: string): Promise<WriteOffAct> {
  const response = await request.post('/acts/writeoff', {
    headers,
    data: {
      inventoryNo,
      reason: 'Приёмочное испытание списания',
      writeOffDate: todayIso(),
    },
  })
  await expectOk(response)
  return response.json()
}

async function installSoftware(request: APIRequestContext, headers: Headers, softwareId: number, inventoryNo: string) {
  const response = await request.post(`/software/${softwareId}/install`, {
    headers,
    data: { assetInventoryNo: inventoryNo },
  })
  await expectOk(response)
  return response.json()
}

async function notifications(request: APIRequestContext, headers: Headers) {
  const response = await request.get('/notifications?size=50', { headers })
  await expectOk(response)
  return response.json()
}

async function logs(request: APIRequestContext, headers: Headers, action: string) {
  const response = await request.get(`/system-logs?action=${action}&size=50`, { headers })
  await expectOk(response)
  return response.json()
}

test.describe('4.2.9 Общие системные функции', () => {
  test('аутентификация определяет роли основных пользователей', async ({ request }) => {
    const expectedRoles = [
      [users.employee, 'EMPLOYEE'],
      [users.specialist, 'IT_SPECIALIST'],
      [users.manager, 'IT_MANAGER'],
      [users.hr, 'HR'],
    ] as const

    for (const [credentials, role] of expectedRoles) {
      const headers = await authHeaders(request, credentials)
      const response = await request.get('/me', { headers })
      await expectOk(response)
      const me = await response.json()
      expect(me).toEqual(expect.objectContaining({ role }))
    }
  })

  test('система отклоняет неверные учётные данные', async ({ request }) => {
    const response = await request.post('/auth/login', {
      data: { login: 'user', password: 'wrong-password' },
    })
    expect(response.status()).toBe(401)
  })

  test('авторизация запрещает операции вне роли', async ({ request }) => {
    const hrHeaders = await authHeaders(request, users.hr)
    const employeeHeaders = await authHeaders(request, users.employee)
    const specialistHeaders = await authHeaders(request, users.specialist)

    const hrTicketResponse = await request.post('/tickets', {
      headers: hrHeaders,
      data: {
        type: 'Ремонт оборудования',
        assetInventoryNo: 'IT-2025-0001',
        justification: 'Проверка ограничения роли HR',
      },
    })
    expect(hrTicketResponse.status()).toBe(403)

    const employeeAssetsResponse = await request.get('/assets', { headers: employeeHeaders })
    expect(employeeAssetsResponse.status()).toBe(403)

    const specialistWriteOffResponse = await request.post('/acts/writeoff', {
      headers: specialistHeaders,
      data: {
        inventoryNo: 'IT-2025-0001',
        reason: 'Проверка ограничения роли IT_SPECIALIST',
        writeOffDate: todayIso(),
      },
    })
    expect(specialistWriteOffResponse.status()).toBe(403)
  })

  test('справочники доступны и используются в операциях', async ({ request }) => {
    const specialistHeaders = await authHeaders(request, users.specialist)
    const assetTypes = await referenceRows(request, specialistHeaders, '/reference/asset-types')
    const statuses = await referenceRows(request, specialistHeaders, '/reference/asset-statuses')
    const roles = await referenceRows(request, specialistHeaders, '/reference/roles')
    const licenseTypes = await referenceRows(request, specialistHeaders, '/reference/license-types')

    expect(assetTypes.length).toBeGreaterThan(0)
    expect(statuses.some((item: { name: string }) => item.name === 'На складе')).toBeTruthy()
    expect(roles.some((item: { name: string }) => item.name === 'EMPLOYEE')).toBeTruthy()
    expect(licenseTypes.length).toBeGreaterThan(0)
  })
})

test.describe('4.2.1 Функции управления оборудованием', () => {
  test('регистрация, просмотр, редактирование и фильтрация оборудования', async ({ request }) => {
    const headers = await authHeaders(request, users.specialist)
    const suffix = `asset-${Date.now()}`
    const asset = await createAsset(request, headers, suffix)
    const storageStatusId = await statusId(request, headers, 'На складе')

    expect(asset.inventoryNo).toMatch(/^IT-\d{4}-\d{4}$/)
    expect(asset.statusId).toBe(storageStatusId)

    const listResponse = await request.get('/assets', { headers })
    await expectOk(listResponse)
    const assets = await listResponse.json()
    expect(assets.some((item: Asset) => item.inventoryNo === asset.inventoryNo)).toBeTruthy()

    const updated = await updateAsset(request, headers, asset, suffix)
    expect(updated.model).toBe(`Acceptance-Updated-${suffix}`)
    expect(Number(updated.cost)).toBe(120000)

    const filteredByStatusResponse = await request.get(`/assets?statusId=${storageStatusId}`, { headers })
    await expectOk(filteredByStatusResponse)
    const filteredByStatus = await filteredByStatusResponse.json()
    expect(filteredByStatus.every((item: Asset) => item.statusId === storageStatusId)).toBeTruthy()

    const filteredByTypeResponse = await request.get(`/assets?typeId=${asset.typeId}`, { headers })
    await expectOk(filteredByTypeResponse)
    const filteredByType = await filteredByTypeResponse.json()
    expect(filteredByType.every((item: Asset) => item.typeId === asset.typeId)).toBeTruthy()
  })

  test('изменение статуса выполняется по бизнес-правилам', async ({ request }) => {
    const headers = await authHeaders(request, users.specialist)
    const suffix = `asset-status-${Date.now()}`
    const asset = await createAsset(request, headers, suffix)
    const repairStatusId = await statusId(request, headers, 'Ремонт')

    const repairResponse = await request.patch(`/assets/${asset.inventoryNo}/status`, {
      headers,
      data: { statusName: 'Ремонт' },
    })
    await expectOk(repairResponse)
    const repairAsset = await repairResponse.json()
    expect(repairAsset.statusId).toBe(repairStatusId)

    const writeOffStatusResponse = await request.patch(`/assets/${asset.inventoryNo}/status`, {
      headers,
      data: { statusName: 'Списано' },
    })
    expect(writeOffStatusResponse.status()).toBeGreaterThanOrEqual(400)
  })
})

test.describe('4.2.2 Функции управления программным обеспечением', () => {
  test('регистрация, просмотр и редактирование ПО', async ({ request }) => {
    const headers = await authHeaders(request, users.specialist)
    const suffix = `software-crud-${Date.now()}`
    const software = await createSoftware(request, headers, suffix)

    expect(software.id).toBeTruthy()
    expect(software.licenseStatus).toBe('Активна')

    const listResponse = await request.get('/software', { headers })
    await expectOk(listResponse)
    const list = await listResponse.json()
    expect(list.some((item: Software) => item.id === software.id)).toBeTruthy()

    const updated = await updateSoftware(request, headers, software, suffix)
    expect(updated.licenseIdentifier).toBe(`ACC-UPDATED-${suffix}`)

    const duplicateResponse = await request.post('/software', {
      headers,
      data: {
        name: software.name,
        version: software.version,
        licenseTypeId: software.licenseTypeId,
        licenseStart: todayIso(),
        licenseEnd: null,
      },
    })
    expect(duplicateResponse.status()).toBeGreaterThanOrEqual(400)
  })

  test('установка, повторная установка и удаление ПО с оборудования', async ({ request }) => {
    const headers = await authHeaders(request, users.specialist)
    const suffix = `software-install-${Date.now()}`
    const asset = await createAsset(request, headers, suffix)
    const software = await createSoftware(request, headers, suffix)

    await installSoftware(request, headers, software.id, asset.inventoryNo)

    const installationsResponse = await request.get(`/software/asset/${asset.inventoryNo}/installations`, { headers })
    await expectOk(installationsResponse)
    const installations = await installationsResponse.json()
    expect(installations.some((item: { softwareId: number }) => item.softwareId === software.id)).toBeTruthy()

    const duplicateInstallResponse = await request.post(`/software/${software.id}/install`, {
      headers,
      data: { assetInventoryNo: asset.inventoryNo },
    })
    expect(duplicateInstallResponse.status()).toBeGreaterThanOrEqual(400)

    const uninstallResponse = await request.delete(`/software/${software.id}/install/${asset.inventoryNo}`, { headers })
    await expectOk(uninstallResponse)

    const emptyInstallationsResponse = await request.get(`/software/asset/${asset.inventoryNo}/installations`, { headers })
    await expectOk(emptyInstallationsResponse)
    const emptyInstallations = await emptyInstallationsResponse.json()
    expect(emptyInstallations.some((item: { softwareId: number }) => item.softwareId === software.id)).toBeFalsy()
  })

  test('система учитывает срок лицензии и статус оборудования', async ({ request }) => {
    const managerHeaders = await authHeaders(request, users.manager)
    const specialistHeaders = await authHeaders(request, users.specialist)
    const suffix = `software-rules-${Date.now()}`
    const asset = await createAsset(request, managerHeaders, suffix)
    const expiredSoftware = await createSoftware(request, specialistHeaders, suffix, '1.0.0', pastIso(1))

    const expiredInstallResponse = await request.post(`/software/${expiredSoftware.id}/install`, {
      headers: specialistHeaders,
      data: { assetInventoryNo: asset.inventoryNo },
    })
    expect(expiredInstallResponse.status()).toBeGreaterThanOrEqual(400)

    await writeOffAsset(request, managerHeaders, asset.inventoryNo)
    const activeSoftware = await createSoftware(request, specialistHeaders, `${suffix}-active`)
    const writtenOffInstallResponse = await request.post(`/software/${activeSoftware.id}/install`, {
      headers: specialistHeaders,
      data: { assetInventoryNo: asset.inventoryNo },
    })
    expect(writtenOffInstallResponse.status()).toBeGreaterThanOrEqual(400)
  })

  test('обновление ПО через заявку заменяет установленную версию', async ({ request }) => {
    const specialistHeaders = await authHeaders(request, users.specialist)
    const employeeHeaders = await authHeaders(request, users.employee)
    const suffix = `software-update-${Date.now()}`
    const productName = `Acceptance Product ${suffix}`
    const asset = await createAsset(request, specialistHeaders, suffix)
    const softwareV1 = await createSoftware(request, specialistHeaders, suffix, '1.0.0', null, productName)
    const softwareV2 = await createSoftware(request, specialistHeaders, suffix, '2.0.0', null, productName)

    await installSoftware(request, specialistHeaders, softwareV1.id, asset.inventoryNo)

    const sameVersionTicketResponse = await request.post('/tickets', {
      headers: employeeHeaders,
      data: {
        type: 'Обновление ПО',
        assetInventoryNo: asset.inventoryNo,
        softwareId: softwareV1.id,
        targetSoftwareVersion: softwareV1.version,
        justification: 'Проверка запрета обновления на текущую версию',
      },
    })
    expect(sameVersionTicketResponse.status()).toBeGreaterThanOrEqual(400)

    const ticket = await createTicket(request, employeeHeaders, {
      type: 'Обновление ПО',
      assetInventoryNo: asset.inventoryNo,
      softwareId: softwareV2.id,
      targetSoftwareVersion: softwareV2.version,
      justification: 'Обновление версии ПО',
    })
    await assignTicket(request, specialistHeaders, ticket.ticketNo)
    await closeTicket(request, specialistHeaders, ticket.ticketNo)

    const installationsResponse = await request.get(`/software/asset/${asset.inventoryNo}/installations`, { headers: specialistHeaders })
    await expectOk(installationsResponse)
    const installations = await installationsResponse.json()
    expect(installations.some((item: { softwareId: number; installedVersion: string }) =>
      item.softwareId === softwareV2.id && item.installedVersion === softwareV2.version,
    )).toBeTruthy()
  })
})

test.describe('4.2.3 Функции управления заявками', () => {
  test('создание, просмотр, назначение и закрытие заявки на ремонт', async ({ request }) => {
    const specialistHeaders = await authHeaders(request, users.specialist)
    const employeeHeaders = await authHeaders(request, users.employee)
    const suffix = `ticket-repair-${Date.now()}`
    const asset = await createAsset(request, specialistHeaders, suffix)
    const repairStatusId = await statusId(request, specialistHeaders, 'Ремонт')
    const storageStatusId = await statusId(request, specialistHeaders, 'На складе')

    const ticket = await createTicket(request, employeeHeaders, {
      type: 'Ремонт оборудования',
      category: 'Диагностика',
      assetInventoryNo: asset.inventoryNo,
      justification: 'Acceptance test repair request',
    })
    expect(ticket.ticketNo).toBeTruthy()
    expect(ticket.statusId).toBe(await ticketStatusId(request, employeeHeaders, 'Новая'))

    const repairAssetsResponse = await request.get('/assets', { headers: specialistHeaders })
    await expectOk(repairAssetsResponse)
    const repairAssets = await repairAssetsResponse.json()
    expect(repairAssets.find((item: Asset) => item.inventoryNo === asset.inventoryNo).statusId).toBe(repairStatusId)

    const listResponse = await request.get('/tickets', { headers: specialistHeaders })
    await expectOk(listResponse)
    const tickets = await listResponse.json()
    expect(tickets.some((item: Ticket) => item.ticketNo === ticket.ticketNo)).toBeTruthy()

    const assigned = await assignTicket(request, specialistHeaders, ticket.ticketNo)
    expect(assigned.assigneeEmployeeNo).toBe('000001')
    expect(assigned.statusId).toBe(await ticketStatusId(request, specialistHeaders, 'В работе'))

    const done = await closeTicket(request, specialistHeaders, ticket.ticketNo)
    expect(done.closedAt).toBeTruthy()
    expect(done.statusId).toBe(await ticketStatusId(request, specialistHeaders, 'Выполнена'))

    const completedAssetsResponse = await request.get('/assets', { headers: specialistHeaders })
    await expectOk(completedAssetsResponse)
    const completedAssets = await completedAssetsResponse.json()
    expect(completedAssets.find((item: Asset) => item.inventoryNo === asset.inventoryNo).statusId).toBe(storageStatusId)
  })

  test('выполнение заявки на установку ПО создаёт установку и уведомления', async ({ request }) => {
    const specialistHeaders = await authHeaders(request, users.specialist)
    const employeeHeaders = await authHeaders(request, users.employee)
    const suffix = `ticket-install-${Date.now()}`
    const asset = await createAsset(request, specialistHeaders, suffix)
    const software = await createSoftware(request, specialistHeaders, suffix)
    const issue = await issueAsset(request, specialistHeaders, asset.inventoryNo)

    const ticket = await createTicket(request, employeeHeaders, {
      type: 'Установка ПО',
      assetInventoryNo: asset.inventoryNo,
      softwareId: software.id,
      justification: 'Необходимо ПО для работы',
    })
    await assignTicket(request, specialistHeaders, ticket.ticketNo)
    await closeTicket(request, specialistHeaders, ticket.ticketNo)

    const installationsResponse = await request.get(`/software/asset/${asset.inventoryNo}/installations`, { headers: specialistHeaders })
    await expectOk(installationsResponse)
    const installations = await installationsResponse.json()
    expect(installations.some((item: { softwareId: number }) => item.softwareId === software.id)).toBeTruthy()

    const employeeNotifications = await notifications(request, employeeHeaders)
    expect(employeeNotifications.content.some((item: { type: string; body: string }) =>
      item.type === 'SOFTWARE_INSTALLED' && item.body.includes(asset.inventoryNo),
    )).toBeTruthy()

    await returnAsset(request, specialistHeaders, issue.actNo)
  })

  test('система запрещает создание заявки для списанного оборудования', async ({ request }) => {
    const managerHeaders = await authHeaders(request, users.manager)
    const employeeHeaders = await authHeaders(request, users.employee)
    const suffix = `ticket-written-off-${Date.now()}`
    const asset = await createAsset(request, managerHeaders, suffix)
    await writeOffAsset(request, managerHeaders, asset.inventoryNo)

    const ticketResponse = await request.post('/tickets', {
      headers: employeeHeaders,
      data: {
        type: 'Ремонт оборудования',
        assetInventoryNo: asset.inventoryNo,
        justification: 'Проверка запрета заявки по списанному оборудованию',
      },
    })
    expect(ticketResponse.status()).toBeGreaterThanOrEqual(400)
  })
})

test.describe('4.2.4 Функции управления актами перемещения оборудования', () => {
  test('оформление выдачи и возврата создаёт связанные акты ОС-2', async ({ request }) => {
    const headers = await authHeaders(request, users.specialist)
    const suffix = `movement-${Date.now()}`
    const asset = await createAsset(request, headers, suffix)
    const exploitationStatusId = await statusId(request, headers, 'Эксплуатация')
    const storageStatusId = await statusId(request, headers, 'На складе')

    const issue = await issueAsset(request, headers, asset.inventoryNo)
    expect(issue.movementType).toBe('ISSUE')
    expect(issue.relatedActNo).toBeFalsy()

    const duplicateIssueResponse = await request.post('/acts/movement/issue', {
      headers,
      data: {
        inventoryNo: asset.inventoryNo,
        employeeNo: '000002',
        issueDate: todayIso(),
      },
    })
    expect(duplicateIssueResponse.status()).toBeGreaterThanOrEqual(400)

    const issuedAssetsResponse = await request.get('/assets', { headers })
    await expectOk(issuedAssetsResponse)
    const issuedAssets = await issuedAssetsResponse.json()
    expect(issuedAssets.find((item: Asset) => item.inventoryNo === asset.inventoryNo).statusId).toBe(exploitationStatusId)

    const ret = await returnAsset(request, headers, issue.actNo)
    expect(ret.movementType).toBe('RETURN')
    expect(ret.relatedActNo).toBe(issue.actNo)

    const returnedAssetsResponse = await request.get('/assets', { headers })
    await expectOk(returnedAssetsResponse)
    const returnedAssets = await returnedAssetsResponse.json()
    expect(returnedAssets.find((item: Asset) => item.inventoryNo === asset.inventoryNo).statusId).toBe(storageStatusId)
  })

  test('список актов и печатные формы ОС-2 доступны пользователю', async ({ request }) => {
    const headers = await authHeaders(request, users.specialist)
    const suffix = `movement-print-${Date.now()}`
    const asset = await createAsset(request, headers, suffix)
    const issue = await issueAsset(request, headers, asset.inventoryNo)

    const listResponse = await request.get('/acts/movement', { headers })
    await expectOk(listResponse)
    const acts = await listResponse.json()
    expect(acts.some((item: MovementAct) => item.actNo === issue.actNo)).toBeTruthy()

    const pdfResponse = await request.get(`/acts/movement/${issue.actNo}/pdf`, { headers })
    await expectOk(pdfResponse)
    expect(pdfResponse.headers()['content-type']).toContain('application/pdf')

    const xlsResponse = await request.get(`/acts/movement/${issue.actNo}/xls`, { headers })
    await expectOk(xlsResponse)
    expect(xlsResponse.headers()['content-type']).toContain('application/vnd.ms-excel')

    await returnAsset(request, headers, issue.actNo)
  })
})

test.describe('4.2.5 Функции управления списанием оборудования', () => {
  test('акт списания переводит оборудование в статус Списано и снимает ПО', async ({ request }) => {
    const headers = await authHeaders(request, users.manager)
    const suffix = `writeoff-${Date.now()}`
    const asset = await createAsset(request, headers, suffix)
    const software = await createSoftware(request, headers, suffix)
    await installSoftware(request, headers, software.id, asset.inventoryNo)

    const writeOffAct = await writeOffAsset(request, headers, asset.inventoryNo)
    expect(writeOffAct.assetInventoryNo).toBe(asset.inventoryNo)
    expect((writeOffAct as WriteOffAct & { actorEmployeeNo?: string }).actorEmployeeNo).toBeUndefined()

    const writtenOffStatusId = await statusId(request, headers, 'Списано')
    const assetsResponse = await request.get('/assets', { headers })
    await expectOk(assetsResponse)
    const assets = await assetsResponse.json()
    expect(assets.find((item: Asset) => item.inventoryNo === asset.inventoryNo).statusId).toBe(writtenOffStatusId)

    const installationsResponse = await request.get(`/software/asset/${asset.inventoryNo}/installations`, { headers })
    await expectOk(installationsResponse)
    expect(await installationsResponse.json()).toEqual([])

    const audit = await logs(request, headers, 'ASSET_WRITTEN_OFF')
    expect(audit.content.some((item: { actorEmployeeNo: string; details: string }) =>
      item.actorEmployeeNo === '000003' && item.details.includes(asset.inventoryNo),
    )).toBeTruthy()
  })

  test('система запрещает списание оборудования с открытой выдачей', async ({ request }) => {
    const headers = await authHeaders(request, users.manager)
    const suffix = `writeoff-issued-${Date.now()}`
    const asset = await createAsset(request, headers, suffix)
    const issue = await issueAsset(request, headers, asset.inventoryNo)

    const response = await request.post('/acts/writeoff', {
      headers,
      data: {
        inventoryNo: asset.inventoryNo,
        reason: 'Проверка запрета списания выданного оборудования',
        writeOffDate: todayIso(),
      },
    })
    expect(response.status()).toBeGreaterThanOrEqual(400)

    await returnAsset(request, headers, issue.actNo)
  })

  test('печатные формы ОС-4 доступны пользователю', async ({ request }) => {
    const headers = await authHeaders(request, users.manager)
    const suffix = `writeoff-print-${Date.now()}`
    const asset = await createAsset(request, headers, suffix)
    const writeOffAct = await writeOffAsset(request, headers, asset.inventoryNo)

    const pdfResponse = await request.get(`/acts/writeoff/${writeOffAct.actNo}/pdf`, { headers })
    await expectOk(pdfResponse)
    expect(pdfResponse.headers()['content-type']).toContain('application/pdf')

    const xlsResponse = await request.get(`/acts/writeoff/${writeOffAct.actNo}/xls`, { headers })
    await expectOk(xlsResponse)
    expect(xlsResponse.headers()['content-type']).toContain('application/vnd.ms-excel')
  })
})

test.describe('4.2.6 Функции уведомлений', () => {
  test('создание и изменение статуса заявки формируют уведомления автору', async ({ request }) => {
    const specialistHeaders = await authHeaders(request, users.specialist)
    const employeeHeaders = await authHeaders(request, users.employee)
    const suffix = `notifications-ticket-${Date.now()}`
    const asset = await createAsset(request, specialistHeaders, suffix)

    const ticket = await createTicket(request, employeeHeaders, {
      type: 'Ремонт оборудования',
      assetInventoryNo: asset.inventoryNo,
      justification: 'Проверка уведомлений по заявке',
    })
    await assignTicket(request, specialistHeaders, ticket.ticketNo)
    await closeTicket(request, specialistHeaders, ticket.ticketNo)

    const employeeNotifications = await notifications(request, employeeHeaders)
    expect(employeeNotifications.content.some((item: { type: string; relatedTicketNo: string }) =>
      item.type === 'TICKET_CREATED' && item.relatedTicketNo === ticket.ticketNo,
    )).toBeTruthy()
    expect(employeeNotifications.content.some((item: { type: string; relatedTicketNo: string }) =>
      item.type === 'TICKET_STATUS_CHANGED' && item.relatedTicketNo === ticket.ticketNo,
    )).toBeTruthy()
  })

  test('выдача оборудования формирует уведомление сотруднику', async ({ request }) => {
    const specialistHeaders = await authHeaders(request, users.specialist)
    const employeeHeaders = await authHeaders(request, users.employee)
    const suffix = `notifications-issue-${Date.now()}`
    const asset = await createAsset(request, specialistHeaders, suffix)
    const issue = await issueAsset(request, specialistHeaders, asset.inventoryNo)

    const employeeNotifications = await notifications(request, employeeHeaders)
    expect(employeeNotifications.content.some((item: { type: string; body: string }) =>
      item.type === 'ASSET_ISSUED' && item.body.includes(asset.inventoryNo),
    )).toBeTruthy()

    await returnAsset(request, specialistHeaders, issue.actNo)
  })

  test('уведомление можно отметить прочитанным', async ({ request }) => {
    const specialistHeaders = await authHeaders(request, users.specialist)
    const employeeHeaders = await authHeaders(request, users.employee)
    const suffix = `notifications-read-${Date.now()}`
    const asset = await createAsset(request, specialistHeaders, suffix)
    const issue = await issueAsset(request, specialistHeaders, asset.inventoryNo)

    const before = await notifications(request, employeeHeaders)
    const unread = before.content.find((item: { id: number; read?: boolean; isRead?: boolean }) => !item.read && !item.isRead)

    expect(unread).toBeTruthy()
    const readResponse = await request.post(`/notifications/${unread.id}/read`, { headers: employeeHeaders })
    await expectOk(readResponse)
    const updated = await readResponse.json()
    expect(Boolean(updated.read ?? updated.isRead)).toBeTruthy()

    await returnAsset(request, specialistHeaders, issue.actNo)
  })
})

test.describe('4.2.7 Функции управления сотрудниками', () => {
  test('HR просматривает, создаёт, редактирует и удаляет сотрудника без активных связей', async ({ request }) => {
    const hrHeaders = await authHeaders(request, users.hr)
    const employeeRoleId = await referenceId(request, hrHeaders, '/reference/roles', 'EMPLOYEE')
    const suffix = Date.now()

    const listResponse = await request.get('/employees', { headers: hrHeaders })
    await expectOk(listResponse)
    const list = await listResponse.json()
    expect(list.length).toBeGreaterThan(0)

    const createResponse = await request.post('/employees', {
      headers: hrHeaders,
      data: {
        lastName: `Тестов${suffix}`,
        firstName: 'Пользователь',
        patronymic: 'Приёмочный',
        position: 'Тестировщик',
        department: 'Учебный отдел',
        login: `acceptance-${suffix}`,
        password: 'acceptance',
        roleId: employeeRoleId,
      },
    })
    await expectOk(createResponse)
    const employee: Employee & { passwordHash?: string } = await createResponse.json()
    expect(employee.employeeNo).toBeTruthy()
    expect(employee.passwordHash).toBeUndefined()

    const updateResponse = await request.put(`/employees/${employee.employeeNo}`, {
      headers: hrHeaders,
      data: {
        lastName: employee.lastName,
        firstName: employee.firstName,
        patronymic: employee.patronymic,
        position: 'Старший тестировщик',
        department: employee.department,
        login: employee.login,
        password: '',
        roleId: employeeRoleId,
      },
    })
    await expectOk(updateResponse)
    const updated = await updateResponse.json()
    expect(updated.position).toBe('Старший тестировщик')

    const deleteResponse = await request.delete(`/employees/${employee.employeeNo}`, { headers: hrHeaders })
    expect(deleteResponse.status()).toBe(204)
  })

  test('система запрещает удаление сотрудника с выданным оборудованием или открытой заявкой', async ({ request }) => {
    const specialistHeaders = await authHeaders(request, users.specialist)
    const hrHeaders = await authHeaders(request, users.hr)
    const employeeHeaders = await authHeaders(request, users.employee)
    const suffix = `employee-rules-${Date.now()}`
    const asset = await createAsset(request, specialistHeaders, suffix)
    const issue = await issueAsset(request, specialistHeaders, asset.inventoryNo, '000002')

    const deleteIssuedEmployeeResponse = await request.delete('/employees/000002', { headers: hrHeaders })
    expect(deleteIssuedEmployeeResponse.status()).toBeGreaterThanOrEqual(400)

    await returnAsset(request, specialistHeaders, issue.actNo)

    await createTicket(request, employeeHeaders, {
      type: 'Ремонт оборудования',
      assetInventoryNo: asset.inventoryNo,
      justification: 'Открытая заявка блокирует удаление',
    })

    const deleteTicketEmployeeResponse = await request.delete('/employees/000002', { headers: hrHeaders })
    expect(deleteTicketEmployeeResponse.status()).toBeGreaterThanOrEqual(400)
  })
})

test.describe('4.2.8 Функции аналитики и отчётности', () => {
  test('аналитическая сводка содержит KPI, распределения, лицензии и динамику актов', async ({ request }) => {
    const headers = await authHeaders(request, users.manager)
    const response = await request.get('/analytics/summary', { headers })
    await expectOk(response)
    const summary = await response.json()

    expect(summary.assets.total).toBeGreaterThanOrEqual(0)
    expect(Number(summary.assets.totalCost)).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(summary.assets.byStatus)).toBeTruthy()
    expect(Array.isArray(summary.assets.byType)).toBeTruthy()
    expect(Array.isArray(summary.tickets.byStatus)).toBeTruthy()
    expect(summary.software).toEqual(expect.objectContaining({
      active: expect.any(Number),
      expiringSoon: expect.any(Number),
      expired: expect.any(Number),
    }))
    expect(Array.isArray(summary.dynamics)).toBeTruthy()
    expect(summary.dynamics.length).toBeGreaterThan(0)
    for (const item of summary.dynamics) {
      expect(item).toEqual(expect.objectContaining({
        month: expect.any(String),
        issues: expect.any(Number),
        returns: expect.any(Number),
        writeoffs: expect.any(Number),
      }))
    }
  })
})
