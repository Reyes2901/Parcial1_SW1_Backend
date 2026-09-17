// modules/projects/projects.service.ts
// Projects CRUD + memberships + roles + persistent invitations (§7.2)

import { prisma } from '../../shared/prisma';
import { NotFoundError, ForbiddenError, ValidationError } from '../../shared/errors';
import type { ProjectRole } from '@prisma/client';
import crypto from 'crypto';

export class ProjectsService {
  async createProject(name: string, ownerId: string) {
    const project = await prisma.project.create({
      data: {
        name,
        ownerId,
        members: {
          create: {
            userId: ownerId,
            role: 'owner',
          },
        },
      },
      include: { members: true },
    });
    return project;
  }

  async listProjects(userId: string) {
    const memberships = await prisma.projectMember.findMany({
      where: { userId },
      include: {
        project: {
          include: {
            owner: { select: { id: true, name: true, email: true } },
            _count: { select: { diagrams: true, members: true } },
          },
        },
      },
    });
    return memberships.map((m) => ({
      ...m.project,
      role: m.role,
    }));
  }

  async getProject(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
        _count: { select: { diagrams: true } },
      },
    });
    if (!project) {
      throw new NotFoundError('Project', projectId);
    }
    return project;
  }

  async updateProject(projectId: string, name: string, userId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundError('Project', projectId);
    if (project.ownerId !== userId) throw new ForbiddenError('Only the owner can update this project');

    return prisma.project.update({
      where: { id: projectId },
      data: { name },
    });
  }

  async deleteProject(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundError('Project', projectId);
    if (project.ownerId !== userId) throw new ForbiddenError('Only the owner can delete this project');

    await prisma.project.delete({ where: { id: projectId } });
    return { message: 'Project deleted' };
  }

  // Persistent invitations in database (§7.2)
  async createInvitation(projectId: string, role: ProjectRole, inviterId: string, expiresInDays = 7) {
    // Verify inviter is owner
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: inviterId } },
    });
    if (!membership || membership.role !== 'owner') {
      throw new ForbiddenError('Only the project owner can create invitations');
    }

    const token = crypto.randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const invitation = await prisma.invitation.create({
      data: {
        projectId,
        token,
        role,
        invitedBy: inviterId,
        expiresAt,
        revoked: false,
      },
    });

    return {
      id: invitation.id,
      invitationLink: `/projects/join/${token}`,
      token: invitation.token,
      role: invitation.role,
      projectId: invitation.projectId,
      expiresAt: invitation.expiresAt,
    };
  }

  async acceptInvitation(token: string, userId: string) {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { project: true },
    });

    if (!invitation) {
      throw new NotFoundError('Invitation');
    }

    if (invitation.revoked) {
      throw new ValidationError('This invitation has been revoked');
    }

    if (new Date() > invitation.expiresAt) {
      throw new ValidationError('This invitation has expired');
    }

    // Check if already a member
    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: invitation.projectId, userId } },
    });
    if (existing) {
      return { message: 'Already a member', role: existing.role, projectId: invitation.projectId };
    }

    const member = await prisma.projectMember.create({
      data: {
        projectId: invitation.projectId,
        userId,
        role: invitation.role,
      },
    });

    return {
      message: 'Joined project successfully',
      projectId: invitation.projectId,
      role: member.role,
    };
  }

  async listInvitations(projectId: string, requesterId: string) {
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: requesterId } },
    });
    if (!membership || membership.role !== 'owner') {
      throw new ForbiddenError('Only the owner can list invitations');
    }

    return prisma.invitation.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        inviter: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async revokeInvitation(projectId: string, invitationId: string, requesterId: string) {
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: requesterId } },
    });
    if (!membership || membership.role !== 'owner') {
      throw new ForbiddenError('Only the owner can revoke invitations');
    }

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation || invitation.projectId !== projectId) {
      throw new NotFoundError('Invitation', invitationId);
    }

    await prisma.invitation.update({
      where: { id: invitationId },
      data: { revoked: true },
    });

    return { message: 'Invitation revoked successfully' };
  }

  async listMembers(projectId: string) {
    return prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });
  }

  async updateMemberRole(projectId: string, targetUserId: string, newRole: ProjectRole, requesterId: string) {
    const requesterMembership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: requesterId } },
    });
    if (!requesterMembership || requesterMembership.role !== 'owner') {
      throw new ForbiddenError('Only the owner can update member roles');
    }

    if (targetUserId === requesterId) {
      throw new ValidationError('Cannot change your own role as owner');
    }

    const updated = await prisma.projectMember.update({
      where: { projectId_userId: { projectId, userId: targetUserId } },
      data: { role: newRole },
    });

    return { message: 'Member role updated', role: updated.role };
  }

  async removeMember(projectId: string, targetUserId: string, requesterId: string) {
    const requesterMembership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: requesterId } },
    });
    if (!requesterMembership || requesterMembership.role !== 'owner') {
      throw new ForbiddenError('Only the owner can remove members');
    }

    if (targetUserId === requesterId) {
      throw new ValidationError('Cannot remove yourself from the project');
    }

    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    });
    return { message: 'Member removed' };
  }
}
