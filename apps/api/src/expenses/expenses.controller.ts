import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AppAuthGuard } from '../common/guards/app-auth.guard';
import { ConfirmExpenseDto } from './dto/confirm-expense.dto';
import { ListExpensesDto } from './dto/list-expenses.dto';
import { ExpensesService } from './expenses.service';

@Controller('expenses')
@UseGuards(AppAuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post('confirm')
  async confirmExpense(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmExpenseDto,
  ) {
    return this.expensesService.confirmExpense(user, dto);
  }

  @Get()
  async listExpenses(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListExpensesDto,
  ) {
    return this.expensesService.listExpenses(user, query);
  }
}
