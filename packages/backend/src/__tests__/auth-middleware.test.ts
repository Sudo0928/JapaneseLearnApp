import type { NextFunction, Request, Response } from 'express';
import { requireAdminKey } from '../middleware/auth';

function createResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;

  return res;
}

describe('requireAdminKey', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAdminKey = process.env.ADMIN_API_KEY;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.ADMIN_API_KEY = originalAdminKey;
  });

  it('개발 환경에서는 요청을 통과시킨다', () => {
    process.env.NODE_ENV = 'development';
    const req = { header: jest.fn() } as unknown as Request;
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    requireAdminKey(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((res.status as jest.Mock)).not.toHaveBeenCalled();
  });

  it('운영 환경에서 관리자 키가 없으면 차단한다', () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_API_KEY = 'secret';
    const req = { header: jest.fn().mockReturnValue(undefined) } as unknown as Request;
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    requireAdminKey(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: '관리자 권한이 필요합니다.' });
  });

  it('운영 환경에서 관리자 키가 일치하면 통과시킨다', () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_API_KEY = 'secret';
    const req = { header: jest.fn().mockReturnValue('secret') } as unknown as Request;
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    requireAdminKey(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((res.status as jest.Mock)).not.toHaveBeenCalled();
  });
});
